///////////////////////////////////////////////////////////////////////////////////
//  行情数据控制
//
//
//////////////////////////////////////////////////////////////////////////////////

function Guid()
{
    function S4()
    {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }
    return "guid" + (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

var JSCHART_DATA_TYPE_ID=
{
    BASE_DATA_ID:1,          //股票基础数据
    BUY_SELL_DATA_ID:2,      //股票5档数据
    MINUTE_DATA_ID:3,        //分时图数据

    KLINE_DATA_ID:100,        //K线
}

//客户端消息ID
var JSCHART_CLIENT_MSG_ID=
{
    HQ_SUBSCRIBE_ID:1,         //订阅数据 Data:{ Type, ID,  Symbol, ArySymbol, ExtendData:{ } }
    HQ_UNSUBSCRIBE_ID:2,       //取消订阅

    HQ_REQUEST_ID:3             //单次数据请求
}

//服务器消息ID
var JSCHART_SERVER_MSG_ID=
{
    PUSH_DATA_ID:1,      //推送数据 Data:{ ID, Type:, AryData: [ { Symbol, Type, Data: { } } ], ExtendData:{ } }
}


//数据订阅结构
function HQSubscribe()
{
    //1=股票基础数据订阅 多股票
    //2=股票基础数据+5档订阅 单股票
    //3=分时图实时数据 单股票
    //4=K线图实时数据 单股票
    this.Type=0; 
    this.ID=null;           //订阅ID
    this.PortID=null;       //端口ID

    this.ArySymbol=[];

    this.Callback=null; //数据到达回调
    this.Counter=0;
    this.MaxCount=5;
    this.Status=0; //0=空闲 1=队列中 2=请求中
    this.bDestroy=false;   //是否销毁   
    this.ExtendData=null;  //扩展数据
}

function HQRequestItem()
{
    this.Type=0;
    this.ID=null;
    this.PortID=null;

    this.ArySymbol=[];
    this.Callback=null; //数据到达回调
    this.ExtendData=null;  //扩展数据
}

//股票基础数据
function StockBase()
{
    this.Name=null;
    this.Open=null;
    this.YClose=null;
    this.Close=null;
    this.High=null;
    this.Low=null;
    this.BidPrice=null;   //竞买价，即“买一”报价
    this.AskPrice=null;
    this.Vol=null;          //成交量
    this.Amount=null;          //成交金额
    this.Date=null;
    this.Time=null;
}

//股票5档
function StockBuySell()
{
    this.Buys=
    [
        { Vol:null, Price:null },
        { Vol:null, Price:null },
        { Vol:null, Price:null },
        { Vol:null, Price:null },
        { Vol:null, Price:null },
    ];   //买档

    this.Sells=
    [
        { Vol:null, Price:null },
        { Vol:null, Price:null },
        { Vol:null, Price:null },
        { Vol:null, Price:null },
        { Vol:null, Price:null },
    ];  //卖档
}

function MinuteItem()
{
    this.Date; 
    this.Time;
    this.Price;
    this.AvPrice;
    this.Vol;
    this.Amount;
}

function StockMinute()
{
    this.Data=[];       //分钟数据  MinuteItem
}

function StockInfo()
{
    this.Symbol;
    this.BaseData;      //StockBase
    this.BuySellData;   //StockBuySell
    this.Minute;
}

function HQChartDataService()
{
    this.IDCounter=1;   //自增长ID
     
    this.Version=1.0001;            //版本号
    this.MapClient=new Map();       //客户端连接缓存 key=PortID
    this.StartTime=null;            //启动时间 { Date:, Time: }
    this.LastTime=null;

    this.MapSubscribe=new Map();        //客户端订阅缓存 key=ID value=HQSubscribe 
    this.SubscribePool=[];              //订阅工作队列
    this.MapStock=new Map();            //股票数据缓存

    this.RequestPool=[];                //请求队列

    this.CreateTaskTimer=null;
    this.CreateThreadTimer=null;

    this.CreateRequestThreadTimer=null;

    this.Create=function()
    { 
        this.StartTime=this.GetCurrentDateTime();

        this.SubThreadMain();   //启动订阅线程

        this.CreateTaskTimer=setInterval(()=>
        {
            this.CreateSubscribeTask();
        }, 500);


        this.CreateThreadTimer=setInterval(() => {
            
            this.SubThreadMain();

        }, 200);

        this.CreateRequestThreadTimer=setInterval(() => {
            
            this.RequestThreadMain();

        }, 200);

        chrome.runtime.onConnectExternal.addListener((port)=>
        {
            this.OnConnect(port);
        });
    }

    this.OnConnect=function(port)
    {
        var id=Guid();
        console.log(`[HQChartDataService::OnConnect][ID=${id}] port.name=${port.name}`);
        var client={ ID:id, Port:port };

        port.onMessage.addListener((msg)=>{ this.OnRecvMessage(client, msg); } );
        port.onDisconnect.addListener(()=>{ this.OnDisconnect(client); } );

        this.MapClient.set(client.ID, client);
    }

    this.OnDisconnect=function(client)
    {
        console.log(`[HQChartDataService::OnDisconnect][ID=${client.ID}] port.name=${client.Port.name}`);

        this.MapClient.delete(client.ID);

        //删除该客户端的所有订阅
        for(var mapItem of this.MapSubscribe)
        {
            var subscribe=mapItem[1];
            if (subscribe.PortID===client.ID)
            {
                subscribe.bDestroy=true;
                this.MapSubscribe.delete(subscribe.ID);
            }
        }
    }

    this.OnRecvMessage=function(client, msg)
    {
        console.log(`[HQChartDataService::OnRecvMessage][ID=${client.ID}] port.name=${client.Port.name}, messageID=${msg.MessageID}`);

        if (msg.MessageID==JSCHART_CLIENT_MSG_ID.HQ_SUBSCRIBE_ID)
        {
            var data=msg.Data;
            if (!data || !data.ID) return;

            var subscribe=new HQSubscribe();
            subscribe.Type=data.Type;
            subscribe.ID=data.ID;
            subscribe.PortID=client.ID;
            subscribe.ArySymbol=data.ArySymbol;
            if (data.ExtendData) subscribe.ExtendData=data.ExtendData;

            this.Subscribe(subscribe);
        }
        else if (msg.MessageID==JSCHART_CLIENT_MSG_ID.HQ_UNSUBSCRIBE_ID)
        {
            var data=msg.Data;
            if (!data || !data.ID) return;
            var subscribe=new HQSubscribe();
            subscribe.Type=data.Type;
            subscribe.ID=data.ID;
            subscribe.PortID=client.ID;

            this.Unsubscribe(subscribe);
        }
        else if (msg.MessageID==JSCHART_CLIENT_MSG_ID.HQ_REQUEST_ID)
        {
            var data=msg.Data;

            var item=new HQRequestItem();
            item.Type=data.Type;
            item.ID=data.ID;
            item.PortID=client.ID;
            item.ArySymbol=data.ArySymbol;
            if (data.ExtendData) subscribe.ExtendData=data.ExtendData;

            this.RequestData(item);
        }
    }

    //订阅数据
    this.Subscribe=function(data)
    {
        if (!data) return;

        var key=data.ID;
        if (!key) return;

        if (this.MapSubscribe.has(key))
        {
            var item=this.MapSubscribe.get(key);
            item.bDestroy=true;
            this.MapSubscribe.set(key, data);
        }
        else
        {
            this.MapSubscribe.set(key, data);
        }

        this.PushSubscribeCacheData(data);
    }

    
    this.Unsubscribe=function(data)
    {
        if (!data) return;

        var key=data.ID;
        if (!key) return;

        if (!this.MapClient.has(key)) return;

        var item=this.MapClient.get(key);
        item.bDestroy=true;
        this.MapClient.delete(key);
    }

    this.RequestData=function(data)
    {
        if (data.Type==JSCHART_DATA_TYPE_ID.KLINE_DATA_ID)
        {
            this.RequestPool.push(data);
        }
    }

    //获取当前最新时间
    this.GetCurrentDateTime=function()
    {
        var date=new Date();
        var obj={Date:null, Time:null, DateTime:date };
        return obj
    }

    //订阅线程
    this.SubThreadMain=function()
    {
        if (this.SubscribePool.length<=0) return;

        var item = this.SubscribePool.shift();
        if (item.Type==1 || item.Type==2)
        {
            var reqData={ Subscribe:item };
            this.ChangeSubscribeStatus(item.ArySubscribe, 2);
            HQData.RequestRealtimeData_SINA(reqData, (recv)=>{ this.RecvRealtimeData(recv,reqData)});
        }
        else if (item.Type==3)  //分时图数据
        {
            var reqData={ Subscribe:item };
            this.ChangeSubscribeStatus(item.ArySubscribe, 2);
            HQData.RequestMinute_QQ(reqData, (recv)=>{ this.RecvMinuteData(recv,reqData)})
        }
    }

    this.RecvRealtimeData=function(recv, option)
    {
        if (recv && recv.Code===0)
        {
            this.UpdateStockData(recv, option);
        }

        if (option && option.Subscribe) this.ChangeSubscribeStatus(option.Subscribe.ArySubscribe, 0);
    }

    //更新股票数据 data={ AryStock:}
    this.UpdateStockData=function(data, option)
    {
        if (!data) return;
        if (option.Subscribe.Type==1)
        {
            var setSymbol=new Set();
            for(var i=0;i<data.AryStock.length;++i)
            {
                var item=data.AryStock[i];
                if (this.MapStock.has(item.Symbol))
                {
                    var stockInfo=this.MapStock.get(item.Symbol);
                    if (this.UpdateStockBaseData(stockInfo,item))
                        setSymbol.add(item.Symbol);
                    if (data.AryType.includes(JSCHART_DATA_TYPE_ID.BUY_SELL_DATA_ID))
                        this.UpdateStockBuySellData(stockInfo,item);
                }
                else
                {
                    var newStockInfo=new StockInfo();
                    newStockInfo.Symbol=item.Symbol;
                    newStockInfo.BaseData=new StockBase();
                    newStockInfo.BuySellData=new StockBuySell();

                    this.UpdateStockBaseData(newStockInfo,item);
                    if (data.AryType.includes(JSCHART_DATA_TYPE_ID.BUY_SELL_DATA_ID))
                        this.UpdateStockBuySellData(newStockInfo,item);

                    setSymbol.add(item.Symbol);
                    this.MapStock.set(item.Symbol, newStockInfo);
                }
            }

            if (setSymbol.size>0)
            {
                this.PushSubscribeData(Array.from(setSymbol), option.Subscribe.Type, option.Subscribe.ArySubscribe);
            }
        }
        else if (option.Subscribe.Type==2)
        {
            var setSymbol=new Set();
            for(var i=0;i<data.AryStock.length;++i)
            {
                var item=data.AryStock[i];
                if (this.MapStock.has(item.Symbol))
                {
                    var stockInfo=this.MapStock.get(item.Symbol);
                    if (this.UpdateStockBaseData(stockInfo,item))
                        setSymbol.add(item.Symbol);
                    if (this.UpdateStockBuySellData(stockInfo,item))
                        setSymbol.add(item.Symbol);
                }
                else
                {
                    var newStockInfo=new StockInfo();
                    newStockInfo.Symbol=item.Symbol;
                    newStockInfo.BaseData=new StockBase();
                    newStockInfo.BuySellData=new StockBuySell();

                    this.UpdateStockBaseData(newStockInfo,item);
                    this.UpdateStockBuySellData(stockInfo,item);

                    setSymbol.add(item.Symbol);
                    this.MapStock.set(item.Symbol, newStockInfo);
                }
            }

            if (setSymbol.size>0)
            {
                this.PushSubscribeData(Array.from(setSymbol), option.Subscribe.Type, option.Subscribe.ArySubscribe);
            }
        }
    }

    this.UpdateItem=function(dest, src, fieldName)
    {
        if (dest[fieldName]!==src[fieldName]) 
        {
            dest[fieldName]=src[fieldName];
            return true;
        }

        return false
    }

    this.UpdateStockBaseData=function(stockItem, data)
    {
        if (!stockItem.BaseData) stockItem.BaseData=new StockBase();
        var dest=stockItem.BaseData;
        var bChange=false;
        if (this.UpdateItem(dest, data, "Name")) bChange=true;
        if (this.UpdateItem(dest, data, "Open")) bChange=true;
        if (this.UpdateItem(dest, data, "YClose")) bChange=true;   
        if (this.UpdateItem(dest, data, "Close")) bChange=true;
        if (this.UpdateItem(dest, data, "High")) bChange=true;   
        if (this.UpdateItem(dest, data, "Low")) bChange=true;
        if (this.UpdateItem(dest, data, "BidPrice")) bChange=true;
        if (this.UpdateItem(dest, data, "AskPrice")) bChange=true;
        if (this.UpdateItem(dest, data, "Vol")) bChange=true;
        if (this.UpdateItem(dest, data, "Amount")) bChange=true;
        if (this.UpdateItem(dest, data, "Date")) bChange=true;
        if (this.UpdateItem(dest, data, "Time")) bChange=true;
        return bChange;
    }

    this.UpdateStockBuySellData=function(stockItem, data)
    {
        if (!stockItem.BuySellData) stockItem.BuySellData=new StockBuySell();
        var dest=stockItem.BuySellData; 
        var bChange=false;
        for(var i=0;i<5;++i)
        {
            if (this.UpdateItem(dest.Buys[i], data.Buys[i], "Vol")) bChange=true;
            if (this.UpdateItem(dest.Buys[i], data.Buys[i], "Price")) bChange=true;
            if (this.UpdateItem(dest.Sells[i], data.Sells[i], "Vol")) bChange=true;
            if (this.UpdateItem(dest.Sells[i], data.Sells[i], "Price")) bChange=true;
        }  

        return bChange; 
    }


    //更新分时图
    this.RecvMinuteData=function(recv, option)
    {
        if (recv && recv.Code===0)
        {
            this.UpdateStockMinuteData(recv, option);
        }

        if (option && option.Subscribe) this.ChangeSubscribeStatus(option.Subscribe.ArySubscribe, 0);
    }

    this.UpdateStockMinuteData=function(data, option)
    {
        if (!data) return;

        var setSymbol=new Set();
        for(var i=0;i<data.AryStock.length;++i)
        {
            var item=data.AryStock[i];
            if (this.MapStock.has(item.Symbol))
            {
                var stockInfo=this.MapStock.get(item.Symbol);
                if (this.UpdateStockMinute(stockInfo, item))
                    setSymbol.add(item.Symbol);
            }
            else
            {
                var newStockInfo=new StockInfo();
                newStockInfo.Symbol=item.Symbol;
                newStockInfo.Minute=new StockMinute();
                this.UpdateStockMinute(newStockInfo, item);
                setSymbol.add(item.Symbol);

                this.MapStock.set(item.Symbol, newStockInfo);
            }
        }

        if (setSymbol.size>0)
        {
            this.PushSubscribeData(Array.from(setSymbol), option.Subscribe.Type, option.Subscribe.ArySubscribe);
        }
    }

    this.UpdateStockMinute=function(stockItem, data)
    {
        if (!stockItem.Minute) stockItem.Minute=new StockMinute();
        var bChange=false;

        if (this.UpdateItem(stockItem.Minute, data, "Name")) bChange=true;
        if (this.UpdateItem(stockItem.Minute, data, "YClose")) bChange=true;

        if (stockItem.Minute.Data.length!=data.Data.length || stockItem.Minute.Date!=data.Date)
        {
            for(var i=0;i<data.Data.length;++i)
            {
                var item=data.Data[i];
                var minItem=new MinuteItem();
                minItem.Date=item.Date;
                minItem.Time=item.Time;
                minItem.Price=item.Price;
                minItem.Vol=item.Vol;
                minItem.Amount=item.Amount;
                minItem.AvPrice=item.AvPrice;

                stockItem.Minute.Data[i]=minItem;
            }

            stockItem.Minute.Data.length=data.Data.length;
            stockItem.Minute.Date=data.Date;
            bChange=true;
        }
        else if (data.Data.length>0)
        {
            //比较最后一条数据
            var dest=stockItem.Minute.Data[data.Data.length-1];
            var src=data.Data[data.Data.length-1];

            if (this.UpdateItem(dest, src, "Date")) bChange=true;
            if (this.UpdateItem(dest, src, "Time")) bChange=true;
            if (this.UpdateItem(dest, src, "YClose")) bChange=true;   
            if (this.UpdateItem(dest, src, "Price")) bChange=true;
            if (this.UpdateItem(dest, src, "Vol")) bChange=true;   
            if (this.UpdateItem(dest, src, "Amount")) bChange=true;
            if (this.UpdateItem(dest, src, "AvPrice")) bChange=true;
        }

        return bChange;
    }

    this.CreateSubscribeTask=function()
    {
        var mapData=new Map();  //key=type value={ ArySymbol:[] }
        mapData.set(1, { SetSymbol:new Set(), Type:1, ArySubscribe:[] } );
        mapData.set(2, { SetSymbol:new Set(), Type:2, ArySubscribe:[] } );
        
        var mapMinute=new Map();    //key=symbol, { Symbol, Type:3, ArySubscribe:[] }

        for(var mapItem of this.MapSubscribe)
        {
            var subscribe=mapItem[1];
            //空闲状态
            if (subscribe.Status!==0) continue;
            if (!IFrameSplitOperator.IsNonEmptyArray(subscribe.ArySymbol)) continue;

            if (subscribe.Type==3)  //分时图
            {
                var symbol=subscribe.ArySymbol[0];
                if (!symbol) continue;
                if (mapMinute.has(symbol))
                {
                    var minItem=mapMinute.get(symbol);
                    minItem.ArySubscribe.push(subscribe);
                }
                else
                {
                    mapMinute.set(symbol, { ArySymbol:[symbol], Type:subscribe.Type, ArySubscribe:[subscribe] })
                }
            }
            else
            {
                var item=mapData.get(subscribe.Type);
                for(var i=0;i<subscribe.ArySymbol.length;++i)
                {
                    item.SetSymbol.add(subscribe.ArySymbol[i]);
                }

                subscribe.Status=1;
                item.ArySubscribe.push(subscribe);
                if (item.SetSymbol.size>=50)  //每次最多20个股票
                {
                    //创建任务
                    var arySymbol=Array.from(item.SetSymbol);
                    this.SubscribePool.push({ Type:item.Type, ArySymbol:arySymbol, ArySubscribe:item.ArySubscribe });  
                    
                    item.SetSymbol.clear();
                    item.ArySubscribe=[];
                }
            }
        }

        //实时股票数据
        for(var mapItem of mapData)
        {
            var item=mapItem[1];
            if (item.SetSymbol.size>0)
            {
                var arySymbol=Array.from(item.SetSymbol);
                this.SubscribePool.push({ Type:item.Type, ArySymbol:arySymbol, ArySubscribe:item.ArySubscribe });   
            }
        }

        //分时图数据
        for(var mapItem of mapMinute)
        {
            var item=mapItem[1];
            this.SubscribePool.push(item);
        }
    }

    this.ChangeSubscribeStatus=function(arySubscribe, status)
    {
        for(var i=0;i<arySubscribe.length;++i)
        {
            arySubscribe[i].Status=status;
        }
    }

    //推送订阅数据
    this.PushSubscribeData=function(arySymbol, type, arySubscribe)
    {
        var mapStock=new Map();
        for(var i=0;i<arySymbol.length;++i)
        {
            var symbol=arySymbol[i];
            if (!this.MapStock.has(symbol)) continue;
            
            var item=this.MapStock.get(symbol);
            mapStock.set(symbol, item);
        }

        for(var i=0;i<arySubscribe.length;++i)
        {
            var subscribe=arySubscribe[i];
            if (subscribe.bDestroy) continue;
            var aryData=[];
            for(var j=0;j<subscribe.ArySymbol.length;++j)
            {
                var symbol=subscribe.ArySymbol[j];
                if (!mapStock.has(symbol)) continue;
                var stockItem=mapStock.get(symbol);
                if (type===1)
                    aryData.push( { Symbol:symbol, Type:type, Data:{ BaseData:stockItem.BaseData } } );
                else if (type===2)
                    aryData.push( { Symbol:symbol, Type:type, Data:{ BaseData:stockItem.BaseData, BuySellData:stockItem.BuySellData } });
                else if (type==3)
                    aryData.push( { Symbol:symbol, Type:type, Data:{ Minute:stockItem.Minute } });
            }

            if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) continue;

            //发送数据
            if (this.MapClient.has(subscribe.PortID))
            {
                var client=this.MapClient.get(subscribe.PortID);
                var sendData=
                {
                    MessageID:JSCHART_SERVER_MSG_ID.PUSH_DATA_ID,
                    
                    Data:
                    {
                        ID:subscribe.ID,
                        Type:type,
                        AryData:aryData,
                        ExtendData:subscribe.ExtendData
                    }
                };

                client.Port.postMessage(sendData);   
            }
        }

    }

    //立即推送缓存数据
    this.PushSubscribeCacheData=function(subscribe)
    {
        if (!this.MapClient.has(subscribe.PortID)) return;

        var client=this.MapClient.get(subscribe.PortID);

        //发送缓存数据
        var aryData=[];
        if (subscribe.Type==1)
        {
            for(var i=0;i<subscribe.ArySymbol.length;++i)
            {
                var symbol=subscribe.ArySymbol[i];
                if (!this.MapStock.has(symbol)) continue;
                var stockItem=this.MapStock.get(symbol);
                aryData.push( { Symbol:symbol, Type:subscribe.Type, Data:{ BaseData:stockItem.BaseData } } );
            }
        }
        else if (subscribe.Type==2)
        {
            for(var i=0;i<subscribe.ArySymbol.length;++i)
            {
                var symbol=subscribe.ArySymbol[i];
                if (!this.MapStock.has(symbol)) continue;
                var stockItem=this.MapStock.get(symbol);
                aryData.push( { Symbol:symbol, Type:subscribe.Type, Data:{ BaseData:stockItem.BaseData, BuySellData:stockItem.BuySellData } } );
            }
        }
        else if (subscribe.Type==3)
        {
            for(var i=0;i<subscribe.ArySymbol.length;++i)
            {
                var symbol=subscribe.ArySymbol[i];
                if (!this.MapStock.has(symbol)) continue;
                var stockItem=this.MapStock.get(symbol);
                aryData.push( { Symbol:symbol, Type:subscribe.Type, Data:{ Minute:stockItem.Minute } } );
            }
        }

        if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) return;

        var sendData=
        {
            MessageID:JSCHART_SERVER_MSG_ID.PUSH_DATA_ID,
            
            Data:
            {
                ID:subscribe.ID,
                Type:subscribe.Type,
                AryData:aryData,
                ExtendData:subscribe.ExtendData
            }
        };

        client.Port.postMessage(sendData);   
    }


    this.RequestThreadMain=function()
    {
        if (this.RequestPool.length<=0) return;

        var item = this.RequestPool.shift();
        if (item.Type==JSCHART_DATA_TYPE_ID.KLINE_DATA_ID)
        {
            var reqData={ Request:item };
            HQData.RequestKLine_QQ(reqData, (recv)=>{ this.RecvKLineData(recv,reqData)});
        }
    }

    this.RecvKLineData=function(recv, option)
    {

    }

}


function HQData()
{

}


HQData.SINA=
{
    //实时股票数据
    Realtime:{ Url:"https://hq.sinajs.cn/", Referer:"https://vip.stock.finance.sina.com.cn/" }
}

HQData.QQ=
{
    Minute:{ Url:"https://web.ifzq.gtimg.cn/appstock/app/"},
    KLine:{ Url:"https://web.ifzq.gtimg.cn/appstock/app/"}
}

HQData.RequestRealtimeData_SINA=function(reqData, callback)
{
    var url=HQData.SINA.Realtime.Url;

    var strSymbol="";
    for(var i=0;i<reqData.Subscribe.ArySymbol.length;++i)
    {
        var symbol=reqData.Subscribe.ArySymbol[i];
        if (!symbol) continue;
        var upperSymbol=symbol.toUpperCase();
        if (MARKET_SUFFIX_NAME.IsSH(upperSymbol)) 
        {
            var value=`sh${JSChart.GetShortSymbol(symbol)}`;
        }
        else if (MARKET_SUFFIX_NAME.IsSZ(upperSymbol))
        {
            var value=`sz${JSChart.GetShortSymbol(symbol)}`;
        }
        else
        {
            continue;
        }

        if (strSymbol.length>0) strSymbol+=",";
        strSymbol+=value;
    }

    url+=`list=${strSymbol}`;

    fetch(url,{ headers:{ "content-type": "application/javascript; charset=GB18030"} } )
    .then(response => 
    { 
        if (!response.ok) 
        {
            throw new Error('网络响应不正常');
        }

        return response.arrayBuffer();
    })
    .then((buffer)=>
    { 
        const decoder = new TextDecoder('gb18030'); //转字符集
        const recv = decoder.decode(buffer);
        HQData.RecvRealtimeData_SINA(recv, callback)
    })
    .catch(
        error => console.error('Error:', error)
    );
}

HQData.RecvRealtimeData_SINA=function(recv, callback)
{
    var aryStock=[];
    var aryLine=recv.split("\n");
    for(var i=0;i<aryLine.length;i++)
    {
        var text=aryLine[i];
        // 捕获 hq_str_<symbol> 和 "..." 中的内容（支持 var/let/const 可选）
        var match = text.match(/(?:var|let|const)?\s*hq_str_([A-Za-z]+\d+)\s*=\s*['"]([^'"]*)['"]/i);
        if (!match || match.length < 3) continue;
        var value=match[1];
        var symbol=null;
        if (value.indexOf("sz")===0) symbol=`${value.substring(2)}.sz`;
        else if (value.indexOf("sh")===0) symbol=`${value.substring(2)}.sh`;
        else continue;

        var match = text.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) continue;
        
        var strValue=match[0];
        var strValue=match[1];
        var arySrcValue=strValue.split(",");

        var item=
        {
            Symbol: symbol,
            Name: arySrcValue[0],
            Open: HQData.StringToNumber(arySrcValue[1]),
            YClose: HQData.StringToNumber(arySrcValue[2]),
            Close: HQData.StringToNumber(arySrcValue[3]),
            High: HQData.StringToNumber(arySrcValue[4]),
            Low: HQData.StringToNumber(arySrcValue[5]),

            BidPrice: HQData.StringToNumber(arySrcValue[6]),   //竞买价，即“买一”报价
            AskPrice: HQData.StringToNumber(arySrcValue[7]),   //竞卖价，即“卖一”报价

            Vol: HQData.StringToNumber(arySrcValue[8]),          //成交量
            Amount: HQData.StringToNumber(arySrcValue[9]),          //成交金额

            Buys: 
            [
                { Vol: HQData.StringToNumber(arySrcValue[10]), Price: HQData.StringToNumber(arySrcValue[11]) },
                { Vol: HQData.StringToNumber(arySrcValue[12]), Price: HQData.StringToNumber(arySrcValue[13]) },
                { Vol: HQData.StringToNumber(arySrcValue[14]), Price: HQData.StringToNumber(arySrcValue[15]) },
                { Vol: HQData.StringToNumber(arySrcValue[16]), Price: HQData.StringToNumber(arySrcValue[17]) },
                { Vol: HQData.StringToNumber(arySrcValue[18]), Price: HQData.StringToNumber(arySrcValue[19]) },  
            ],
            
            Sells: 
            [
                { Vol: HQData.StringToNumber(arySrcValue[20]), Price: HQData.StringToNumber(arySrcValue[21]) },
                { Vol: HQData.StringToNumber(arySrcValue[22]), Price: HQData.StringToNumber(arySrcValue[23]) },
                { Vol: HQData.StringToNumber(arySrcValue[24]), Price: HQData.StringToNumber(arySrcValue[25]) },
                { Vol: HQData.StringToNumber(arySrcValue[26]), Price: HQData.StringToNumber(arySrcValue[27]) },
                { Vol: HQData.StringToNumber(arySrcValue[28]), Price: HQData.StringToNumber(arySrcValue[29]) },
            ], 

            Date: HQData.StringToDateNumber(arySrcValue[30]),
            Time: HQData.StringToTimeNumber(arySrcValue[31]),
        }

        aryStock.push(item);
    }

    callback({ AryStock:aryStock, Code:0, AryType:[ JSCHART_DATA_TYPE_ID.BASE_DATA_ID,JSCHART_DATA_TYPE_ID.BUY_SELL_DATA_ID ] });
}





HQData.ConvertToQQSymbol=function(symbol)
{
    var upperSymbol=symbol.toUpperCase();
    var fixedSymbol=JSChart.GetShortSymbol(symbol);
    if (MARKET_SUFFIX_NAME.IsSH(upperSymbol)) 
    {
        fixedSymbol=`sh${JSChart.GetShortSymbol(symbol)}`;
    }
    else if (MARKET_SUFFIX_NAME.IsSZ(upperSymbol))
    {
        fixedSymbol=`sz${JSChart.GetShortSymbol(symbol)}`;
    }

    return fixedSymbol;
}

//分时图
HQData.RequestMinute_QQ=function(reqData, callback)
{
    var url="https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz000001";

    var symbol=reqData.Subscribe.ArySymbol[0];
    var fixedSymbol=HQData.ConvertToQQSymbol(symbol);

    var url=`${HQData.QQ.Minute.Url}minute/query?code=${fixedSymbol}`;

    fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}})
    .then(response => 
    { 
        if (!response.ok) 
        {
            throw new Error('网络响应不正常');
        }

        return response.json();
    })
    .then((recv)=>
    { 
        HQData.RecvMinute_QQ(recv, callback, { Symbol:symbol, FixedSymbol:fixedSymbol })
    })
    .catch(
        error => console.error('Error:', error)
    );
}

HQData.RecvMinute_QQ=function(recv, callback, symbolInfo)
{
    var stock={ Symbol:symbolInfo.Symbol, Data:[] };
    var code=1;
    if (recv && recv.code===0 && recv.data && recv.data[symbolInfo.FixedSymbol] && recv.data[symbolInfo.FixedSymbol].data)
    {
        var stockItem=recv.data[symbolInfo.FixedSymbol];
        var date=parseInt(stockItem.data.date);
        stock.Date=date;
        if (IFrameSplitOperator.IsNonEmptyArray(stockItem.data.data) && date>0)
        {
            var preVol=0;
            var preAmount=0;
            for(var i=0;i<stockItem.data.data.length;++i)
            {
                var strItem=stockItem.data.data[i];
                var aryData=strItem.split(' ');

                var time=parseInt(aryData[0]);
                var price=parseFloat(aryData[1]);
                var vol=parseFloat(aryData[2])*100;
                var amount=parseFloat(aryData[3]);
                var avprice=amount/vol;

                var minItem={ Date:date, Time:time, Price:price, Vol:vol-preVol, Amount:amount-preAmount, AvPrice:avprice };

                preVol=vol;
                preAmount=amount;

                stock.Data.push(minItem);
            }

            if (stockItem.qt && IFrameSplitOperator.IsNonEmptyArray(stockItem.qt[symbolInfo.FixedSymbol]))
            {
                var aryData=stockItem.qt[symbolInfo.FixedSymbol];
                var name=aryData[1];
                var yClose=parseFloat(aryData[4]);

                stock.Name=name;
                stock.YClose=yClose;
            }

            code=0;
        }
    }

    callback({ AryStock:[stock], Code:code, AryType:[ JSCHART_DATA_TYPE_ID.BASE_DATA_ID,JSCHART_DATA_TYPE_ID.MINUTE_DATA_ID ] });
}

//K线图
HQData.RequestKLine_QQ=function(reqData, callback)
{
    var url="https://web.ifzq.gtimg.cn/appstock/app/kline/kline?_var=kline_week&param=usMSFT.OQ,week,,,320";

    var symbol=reqData.Request.ArySymbol[0];
    var fixedSymbol=HQData.ConvertToQQSymbol(symbol);

    //1999-01-01,2000-12-31
    var startDate="";   //1999-01-01
    var endDate="";
    var count=640;

    var url=`${HQData.QQ.KLine.Url}newkline/newkline?param=${fixedSymbol},day,${startDate},${endDate},${count}`;

    fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}})
    .then(response => 
    { 
        if (!response.ok) 
        {
            throw new Error('网络响应不正常');
        }

        return response.json();
    })
    .then((recv)=>
    { 
        HQData.RecvKLine_QQ(recv, callback, { Symbol:symbol, FixedSymbol:fixedSymbol })
    })
    .catch(
        error => console.error('Error:', error)
    );
}

HQData.RecvKLine_QQ=function(recv, callback, symbolInfo)
{

}


HQData.StringToNumber=function(value)
{
    var num=parseFloat(value);
    if (isNaN(num)) return null;

    return num;
}

HQData.StringToDateNumber=function(value)
{
    if (typeof value !== 'string') return null;
    const m = value.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/);
    if (!m) return null;
    return Number(m[1] + m[2] + m[3]);
}

HQData.StringToTimeNumber=function(value)
{
    if (typeof value !== 'string') return null;
    const m = value.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const hh = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const ss = m[3].padStart(2, '0');
    return Number(hh + mm + ss);
}

