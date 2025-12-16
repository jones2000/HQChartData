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
    BASE_DATA_ID:1,           //股票基础数据
    BASE_DATA_V2_ID:2,        //股票基础数据V2
    MINUTE_DATA_ID:3,         //分时图数据
    DETAIL_DATA_ID:4,         //成交明细
    DETAIL_FULL_DATA_ID:5,    //成交明细 全部
    DETAIL_PRICE_ID:6,        //分价表

    KLINE_DAY_DATA_ID:100,        //日K线
    KLINE_MIN_DATA_ID:101,        //分钟K
    
    SHARE_ID:200,           //股票股本数据
}

//客户端消息ID
var JSCHART_CLIENT_MSG_ID=
{
    HQ_REQUEST_ID:3             //单次数据请求
}

//服务器消息ID
var JSCHART_SERVER_MSG_ID=
{
    HQ_DATA_ID:2,      //推送数据 Data:{ ID, Type:, AryData: [ { Symbol, Type, Data: { } } ], ExtendData:{ } }
}


function HQRequestItem()
{
    this.Type=0;
    this.ID=null;
    this.PortID=null;

    this.ArySymbol=[];  //{ Symbol:, 参数: .... }

    this.Callback=null;     //数据到达回调
    this.ExtendData=null;   //扩展数据
}

class HQChartDataService
{
    IDCounter=1;   //自增长ID
     
    Version=1.0002;            //版本号
    MapClient=new Map();       //客户端连接缓存 key=PortID
    StartTime=null;            //启动时间 { Date:, Time: }
    LastTime=null;

    RequestPool=[];                //请求队列

    RequestThreadInfo=
    [
        { Timer:null, Status:0, Delay:200 },
    ];

    Create()
    { 
        this.StartTime=this.GetCurrentDateTime();

        for(var i=0;i<this.RequestThreadInfo.length;++i)
        {
            var item=this.RequestThreadInfo[i];
            this.RunRequestTask(item);
        }

        chrome.runtime.onConnectExternal.addListener((port)=>
        {
            this.OnConnect(port);
        });
    }

    RunRequestTask(threadInfo)
    {
        threadInfo.Timer=setInterval(() => 
        {
            this.RequestThreadMain(threadInfo);

        }, threadInfo.Delay);
    }

    OnConnect(port)
    {
        var id=Guid();
        console.log(`[HQChartDataService::OnConnect][ID=${id}] port.name=${port.name}`);
        var client={ ID:id, Port:port, IsConnected:true };

        port.onMessage.addListener((msg)=>{ this.OnRecvMessage(client, msg); } );
        port.onDisconnect.addListener(()=>{ this.OnDisconnect(client); } );

        this.MapClient.set(client.ID, client);
    }

    OnDisconnect(client)
    {
        console.log(`[HQChartDataService::OnDisconnect][ID=${client.ID}] port.name=${client.Port.name}`);

        if (this.MapClient.has(client.ID))
        {
            var item=this.MapClient.get(client.ID);
            item.IsConnected=false;
            this.MapClient.delete(client.ID);
        }
    }

    OnRecvMessage(client, msg)
    {
        console.log(`[HQChartDataService::OnRecvMessage][ID=${client.ID}] port.name=${client.Port.name}, messageID=${msg.MessageID}`);

        if (msg.MessageID==JSCHART_CLIENT_MSG_ID.HQ_REQUEST_ID)
        {
            var data=msg.Data;

            var item=new HQRequestItem();
            item.Type=data.Type;
            item.ID=data.ID;
            item.PortID=client.ID;
            item.ArySymbol=data.ArySymbol;
            if (data.ExtendData) item.ExtendData=data.ExtendData;

            this.RequestData(item);
        }
    }

    RequestData(data)
    {
        switch(data.Type)
        {
            case JSCHART_DATA_TYPE_ID.KLINE_DAY_DATA_ID:
            case JSCHART_DATA_TYPE_ID.KLINE_MIN_DATA_ID:
            case JSCHART_DATA_TYPE_ID.MINUTE_DATA_ID:
            case JSCHART_DATA_TYPE_ID.BASE_DATA_ID:
            case JSCHART_DATA_TYPE_ID.BASE_DATA_V2_ID:
            case JSCHART_DATA_TYPE_ID.SHARE_ID:
            case JSCHART_DATA_TYPE_ID.DETAIL_DATA_ID:
            case JSCHART_DATA_TYPE_ID.DETAIL_FULL_DATA_ID:
            case JSCHART_DATA_TYPE_ID.DETAIL_PRICE_ID:
                var bFind=false;
                for(var i=0;i<this.RequestPool.length;++i)
                {
                    var item=this.RequestPool[i];
                    if (item.ID==data.ID && item.Type==data.Type)
                    {
                        this.RequestPool[i]=data;
                        bFind=true;
                        break;
                    }
                }
                if (!bFind)  this.RequestPool.push(data);
                break;
        }
    }

    //获取当前最新时间
    GetCurrentDateTime()
    {
        var datetime=new Date();
        var date=datetime.getFullYear()*10000+(datetime.getMonth()+1)*100+datetime.getDate();
        var time=datetime.getHours()*10000+datetime.getMinutes()*100+datetime.getSeconds();
        var obj={Date:date, Time:time, DateTime:date };
        return obj
    }

    RequestThreadMain()
    {
        if (this.RequestPool.length<=0) return;

        var item = this.RequestPool.shift();
        switch(item.Type)
        {
            case JSCHART_DATA_TYPE_ID.KLINE_DAY_DATA_ID:    //日K数据
                var reqData={ Request:item };
                this.RequestKLine(reqData);
                break;
            case JSCHART_DATA_TYPE_ID.KLINE_MIN_DATA_ID:    //分钟K线
                var reqData={ Request:item };
                this.RequestKLineMinute(reqData);
                break;


            case JSCHART_DATA_TYPE_ID.MINUTE_DATA_ID:       //分时图
                var reqData={ Request:item };
                this.RequestMinute(reqData);
                break;
            case JSCHART_DATA_TYPE_ID.BASE_DATA_ID:         //股票行情数据
                var reqData={ Request:item };
                this.RequestStockRealtime(reqData);
                break;
            case JSCHART_DATA_TYPE_ID.BASE_DATA_V2_ID:     //股票行情数据V2
                var reqData={ Request:item };
                this.RequestStockRealtimeV2(reqData);
                break;

            case JSCHART_DATA_TYPE_ID.SHARE_ID:         //股票股本数据
                var reqData={ Request:item };
                this.RequestShare(reqData);
                break;

            case JSCHART_DATA_TYPE_ID.DETAIL_DATA_ID:       //成交明细
                var reqData={ Request:item };
                this.RequestStockDetail(reqData);
                break;
            case JSCHART_DATA_TYPE_ID.DETAIL_FULL_DATA_ID:
                var reqData={ Request:item };
                this.RequestStockDetailFull(reqData);
                break;
            case JSCHART_DATA_TYPE_ID.DETAIL_PRICE_ID:
                var reqData={ Request:item };
                this.RequestStockDetailPrice(reqData);
                break;
        }
       
    }

    //历史K线
    RequestKLine(reqData)
    {
        HQDataV2.RequestKLine_Day_QQ(reqData).then((recv)=>
        {
             this.RecvKLineData(recv,reqData)
        });
    }

    RecvKLineData(recv, option)
    {
        var request=option.Request;
        var data={ AryStock:[], Code:0 };
        for(var i=0;i<recv.AryData.length;++i)
        {
            var item=recv.AryData[i];
            if (item.Code!==0)
            {
                data.AryStock.push({ Symbol:item.Symbol, Data:null });
            }
            else
            {
                data.AryStock.push(item.Stock)
            }
        }

        this.SendHQData(request, data);
    }

    RequestKLineMinute(reqData)
    {
        HQDataV2.RequestKLine_Minute_QQ(reqData).then((recv)=>
        {
            this.RecvKLineMinuteData(recv,reqData)
        });
    }

    RecvKLineMinuteData(recv,option)
    {
        var request=option.Request;
        var data={ AryStock:[], Code:0 };
        for(var i=0;i<recv.AryData.length;++i)
        {
            var item=recv.AryData[i];
            if (item.Code!==0)
            {
                data.AryStock.push({ Symbol:item.Symbol, Data:null });
            }
            else
            {
                data.AryStock.push(item.Stock)
            }
        }
        this.SendHQData(request, data);
    }

    //分时图
    RequestMinute(reqData)
    {
        HQDataV2.RequestMinuteV2_QQ(reqData).then((recv)=>
        {
            this.RecvMinuteData(recv,reqData)
        })
    }

    RecvMinuteData(recv, option)
    {
        var request=option.Request;
        var data={ AryStock:[], Code:0 };
        for(var i=0;i<recv.AryData.length;++i)
        {
            var item=recv.AryData[i];
            if (item.Code!==0)
            {
                data.AryStock.push({ Symbol:item.Symbol, Data:null });
            }
            else
            {
                data.AryStock.push(item.Stock)
            }
        }

        this.SendHQData(request, data);
    }

    SendHQData(reqItem, recv)
    {
        var code=1;
        if (recv && IFrameSplitOperator.IsNumber(recv.Code)) code=recv.Code;

        if (!this.MapClient.has(reqItem.PortID)) return;
        var client=this.MapClient.get(reqItem.PortID);
        if (!client || !client.IsConnected) return;

        var sendData=
        {
            MessageID:JSCHART_SERVER_MSG_ID.HQ_DATA_ID,
            Code:code,

            Data:
            {
                ID:reqItem.ID,
                Type:reqItem.Type,
                AryData:[],
                ExtendData:reqItem.ExtendData
            }
        };

        if (recv && IFrameSplitOperator.IsNonEmptyArray(recv.AryStock))
        {
            for(var i=0;i<recv.AryStock.length;++i)
            {
                var item=recv.AryStock[i];
                sendData.Data.AryData.push(item);
            }
        }

        client.Port.postMessage(sendData);  
    }

    //股票实时数据
    RequestStockRealtime(reqData)
    {
        HQDataV2.RequestStockRealtimeData_SINA(reqData).then((recv)=>
        {
            this.RecvStockRealtimeData(recv, reqData);
        });
}

    RecvStockRealtimeData(recv, option)
    {
        var request=option.Request;
        var data={ AryStock:recv.AryData, Code:0 };
        this.SendHQData(request, data);
    }

    //股票实时+5档
    RequestStockRealtimeV2(reqData)
    {
        HQDataV2.RequestStockRealtimeData_QQ(reqData).then((recv)=>
        {
            this.RecvStockRealtimeDataV2(recv, reqData);
        });
    }

    RecvStockRealtimeDataV2(recv, option)
    {
        var request=option.Request;
        var data={ AryStock:[], Code:0 };
        for(var i=0;i<recv.AryData.length;++i)
        {
            var item=recv.AryData[i];
            if (item.Code===0)
            {
                data.AryStock.push(item.Stock);
            }
        }
        this.SendHQData(request, data);
    }


    RequestShare(reqData)
    {
        HQDataV2.RequestShare_EASTMONEY(reqData).then((recv)=>
        {
             this.RecvShare(recv, reqData);
        });
    }

    RecvShare(recv, option)
    {
        var request=option.Request;
        var data={ AryStock:[], Code:0 };
        for(var i=0;i<recv.AryData.length;++i)
        {
            var item=recv.AryData[i];
            if (item.Code!==0)
            {
                data.AryStock.push({ Symbol:item.Symbol, Data:null });
            }
            else
            {
                data.AryStock.push(item.Stock)
            }
        }

        this.SendHQData(request, data);
    }

    RequestStockDetail(reqData)
    {
        HQDataV2.RequestDetail_QQ(reqData).then((recv)=>
        {
            this.RecvStockDetail(recv, reqData);
        });
    }

    RecvStockDetail(recv, option)
    {
        var request=option.Request;
        var data={ AryStock:[], Code:0 };
        for(var i=0;i<recv.AryData.length;++i)
        {
            var item=recv.AryData[i];
            if (item.Code===0)
            {
                data.AryStock.push(item.Stock);
            }
        }
        this.SendHQData(request, data);
    }

    RequestStockDetailFull(reqData)
    {
        HQDataV2.RequestDetailV2_QQ(reqData).then((recv)=>
        {
            this.RecvStockDetail(recv, reqData);
        });
    }

    RequestStockDetailPrice(reqData)
    {
        HQDataV2.RequestDetailPrice_QQ(reqData).then((recv)=>
        {
            this.RecvStockDetail(recv, reqData);
        });

    }
}


class HQDataV2
{
    static QQ=
    {
        //https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query?_var=min_data_usBABAN&code=usBABA.N&r=0.6831116862839021 美股
        Minute:{ Url:"https://web.ifzq.gtimg.cn/appstock/app/"},
        KLine:{ Url:"https://web.ifzq.gtimg.cn/appstock/app/"},
        KLineMinute:{ Url:"https://ifzq.gtimg.cn/appstock/app/kline/mkline"},
        Realtime:{ Url:"https://sqt.gtimg.cn/" },   //实时股票数据 单个单个取
        Detail: //成交明细
        { 
            Realtime:{ Url:"https://proxy.finance.qq.com/ifzqgtimg/appstock/app/dealinfo/getMingxiV2" },    //最新成交明细

            //https://stock.gtimg.cn/data/index.php?appn=detail&action=timeline&c=sz000547
            //https://stock.gtimg.cn/data/index.php?appn=detail&action=data&c=sz000547&p=67
            Full: { Url:"https://stock.gtimg.cn/data/index.php"},   //历史成交明细
            
            //https://stock.gtimg.cn/data/index.php?appn=price&c=sh600000&_=1765470041440
            Price:{ Url:"https://stock.gtimg.cn/data/index.php" }   //分价表
        }
    }

    //代码
    static ConvertToQQSymbol(symbol)
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

    //周期
    static ConvertToQQPeriod(periodID)
    {
        var MAP_PERIOD=new Map(
            [
                [0, 'day'],   //day
                [1, 'week'],   //week
                [2, 'month'],   //month

                [5, 'm5'],    //5min
                [6, 'm15'],   //15min
                [7, 'm30'],   //30min
                [8, 'm60'],   //60min
            ]
        );

        return MAP_PERIOD.get(periodID);
    }

    //复权
    static ConvertToQQRight(rightID)
    {
        if (rightID==0) return '';
        else if (rightID==2) return "hfq";
        else if (rightID==1) return "qfq";
        else return ""
    }

    //分时图
    static async RequestMinuteV2_QQ(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);

            //var url="https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz000001";
            var url=`${HQDataV2.QQ.Minute.Url}minute/query?code=${fixedSymbol}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JsonToMinuteData_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToMinuteData_QQ(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        if (recv && recv.code===0 && recv.data && recv.data[symbolInfo.FixedSymbol] && recv.data[symbolInfo.FixedSymbol].data)
        {
            var stockItem=recv.data[symbolInfo.FixedSymbol];
            var date=parseInt(stockItem.data.date);
            stock.Date=date;
            if (IFrameSplitOperator.IsNonEmptyArray(stockItem.data.data) && date>0)
            {
                var preVol=0;
                var preAmount=0;
                var volBase=100;
                var totalAmount=0;
                for(var i=0;i<stockItem.data.data.length;++i)
                {
                    var strItem=stockItem.data.data[i];
                    var aryData=strItem.split(' ');

                    var time=parseInt(aryData[0]);
                    var price=parseFloat(aryData[1]);
                    var vol=parseFloat(aryData[2])*volBase;
                    var amount=parseFloat(aryData[3]);

                    var minItem={ Date:date, Time:time, Price:price, Vol:vol-preVol, Amount:amount-preAmount, AvPrice:null };

                    preVol=vol;
                    preAmount=amount;

                    //均价
                    totalAmount+=minItem.Vol*minItem.Price;
                    minItem.AvPrice=totalAmount/vol;

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
            }
        }

        return stock;
    }

    //日K数据
    static async RequestKLine_Day_QQ(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var period=0, count=640, right=0;
            var startDate="", endDate="";   //1999-01-01
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;
            if (IFrameSplitOperator.IsNumber(item.Period)) period=item.Period;
            if (IFrameSplitOperator.IsNumber(item.Right)) right=item.Right;

            var fixedPeriod=HQDataV2.ConvertToQQPeriod(period);
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);
            var fixedRight=HQDataV2.ConvertToQQRight(right);

            try
            {
                //var url="https://web.ifzq.gtimg.cn/appstock/app/kline/kline?_var=kline_week&param=usMSFT.OQ,week,,,320";
                var url=`${HQDataV2.QQ.KLine.Url}newkline/newkline?param=${fixedSymbol},${fixedPeriod},${startDate},${endDate},${count}`;
                if (right===1 || right===2) //复权
                    url=`${HQDataV2.QQ.KLine.Url}newfqkline/get?param=${fixedSymbol},${fixedPeriod},${startDate},${endDate},${count},${fixedRight}`;

                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JosnToKLineData_Day_QQ(recv,  { Symbol:symbol, FixedSymbol:fixedSymbol, FixedPeriod:fixedPeriod, FixedRight:fixedRight });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JosnToKLineData_Day_QQ(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        var dataName=`${symbolInfo.FixedRight}${symbolInfo.FixedPeriod}`;
        if (recv && recv.code===0 && recv.data && recv.data[symbolInfo.FixedSymbol])
        {
            var stockItem=recv.data[symbolInfo.FixedSymbol];
            if (IFrameSplitOperator.IsNonEmptyArray(stockItem[dataName]) && stockItem.prec>0)
            {
                var yClose=parseFloat(stockItem.prec);
                var aryData=stockItem[dataName];
                for(var i=0;i<aryData.length;++i)
                {
                    var item=aryData[i];
                    var aryDate = item[0].split('-')
                    var date=parseInt(aryDate[0])*10000+parseInt(aryDate[1])*100+parseInt(aryDate[2]);
                    var open=parseFloat(item[1]);
                    var close=parseFloat(item[2]);
                    var high=parseFloat(item[3]);
                    var low=parseFloat(item[4]);
                    var vol=parseFloat(item[5])*100;
                    //var amount=parseFloat(item[8]);
                    var amount=null;

                    var kItem={ Date:date, YClose:yClose,  Open:open, Close:close, High:high, Low:low, Vol:vol, Amount:amount };
                    yClose=close;
                    stock.Data.push(kItem);
                }

                if (stockItem.qt && IFrameSplitOperator.IsNonEmptyArray(stockItem.qt[symbolInfo.FixedSymbol]))
                {
                    var aryData=stockItem.qt[symbolInfo.FixedSymbol];
                    var name=aryData[1];
                    stock.Name=name;
                }
            }
        }

        return stock;
    }

    //分钟K线数据
    static async RequestKLine_Minute_QQ(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var period=5, count=640, right=0;
            var startDate="", endDate="";   //1999-01-01
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;
            if (IFrameSplitOperator.IsNumber(item.Period)) period=item.Period;
            //if (IFrameSplitOperator.IsNumber(item.Right)) right=item.Right;  //接口不支持复权

            var fixedPeriod=HQDataV2.ConvertToQQPeriod(period);
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);
            var fixedRight=HQDataV2.ConvertToQQRight(right);

            try
            {
                //var url="https://ifzq.gtimg.cn/appstock/app/kline/mkline?param=sh600000,m5,,320&_var=m5_today&r=0.5825802203415905";
                var url=`${HQDataV2.QQ.KLineMinute.Url}?param=${fixedSymbol},${fixedPeriod},,${count}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JosnToKLineData_Minute_QQ(recv,  { Symbol:symbol, FixedSymbol:fixedSymbol, FixedPeriod:fixedPeriod, FixedRight:fixedRight });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JosnToKLineData_Minute_QQ(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        var dataName=`${symbolInfo.FixedRight}${symbolInfo.FixedPeriod}`;
        if (recv && recv.code===0 && recv.data && recv.data[symbolInfo.FixedSymbol])
        {
            var stockItem=recv.data[symbolInfo.FixedSymbol];
            if (IFrameSplitOperator.IsNonEmptyArray(stockItem[dataName]) && stockItem.prec>0)
            {
                var yClose=parseFloat(stockItem.prec);
                var aryData=stockItem[dataName];
                for(var i=0;i<aryData.length;++i)
                {
                    var item=aryData[i];
                    var value=parseInt(item[0]);
                    var date=parseInt(value/10000);
                    var time=value%10000;
                    var open=parseFloat(item[1]);
                    var close=parseFloat(item[2]);
                    var high=parseFloat(item[3]);
                    var low=parseFloat(item[4]);
                    var vol=parseFloat(item[5])*100;
                    var amount=null;

                    var kItem={ Date:date, Time:time, YClose:yClose,  Open:open, Close:close, High:high, Low:low, Vol:vol, Amount:amount };
                    yClose=close;
                    stock.Data.push(kItem);
                }

                if (stockItem.qt && IFrameSplitOperator.IsNonEmptyArray(stockItem.qt[symbolInfo.FixedSymbol]))
                {
                    var aryData=stockItem.qt[symbolInfo.FixedSymbol];
                    var name=aryData[1];
                    stock.Name=name;
                }
            }
        }

        return stock;
    }

    //实时股票数据
    static async RequestStockRealtimeData_QQ(reqData)
    {
        var mapExtendData=new Map();    //扩展数据
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            if (item.Fields)
            {
                if (item.Fields.ShareCapital)
                {
                    if (mapExtendData.has(item.Symbol)) mapExtendData.get(item.Symbol).ShareCapital=true;
                    else mapExtendData.set(item.Symbol, { ShareCapital:true });
                }
            }
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);
            //url="https://sqt.gtimg.cn//?q=sh600000&fmt=json&app=wzq&t=1764978336046"
            var url=`${HQDataV2.QQ.Realtime.Url}?q=${fixedSymbol}&fmt=json&app=wzq&t=${Date.now()}`;
            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=GBK"}});
                const buffer = await response.arrayBuffer();
                const decoder = new TextDecoder('GBK'); //转字符集
                const strRecv = decoder.decode(buffer);
                var recv=JSON.parse(strRecv);
                var stockItem=HQDataV2.JsonToStockRealtimData_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                if (!stockItem) result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
                else result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        if (mapExtendData.size>0)
        {
            for(var i=0;i<result.AryData.length;++i)
            {
                var stockItem=result.AryData[i];
                if (!stockItem || !stockItem.Stock) continue;
                if (!mapExtendData.has(stockItem.Symbol)) continue;
                var symbol=stockItem.Symbol;
                var extendData=mapExtendData.get(stockItem.Symbol);
                if (extendData.ShareCapital)
                {
                    var upperSymbol=symbol.toUpperCase();
                    var count=1;
                    if (IFrameSplitOperator.IsNumber(item.Count)) count=1;

                    try
                    {
                        //var url='https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_EH_EQUITY&columns=SECUCODE,SECURITY_CODE,END_DATE,TOTAL_SHARES,LIMITED_SHARES,LIMITED_OTHARS,LIMITED_DOMESTIC_NATURAL,LIMITED_STATE_LEGAL,LIMITED_OVERSEAS_NOSTATE,LIMITED_OVERSEAS_NATURAL,UNLIMITED_SHARES,LISTED_A_SHARES,B_FREE_SHARE,H_FREE_SHARE,FREE_SHARES,LIMITED_A_SHARES,NON_FREE_SHARES,LIMITED_B_SHARES,OTHER_FREE_SHARES,LIMITED_STATE_SHARES,LIMITED_DOMESTIC_NOSTATE,LOCK_SHARES,LIMITED_FOREIGN_SHARES,LIMITED_H_SHARES,SPONSOR_SHARES,STATE_SPONSOR_SHARES,SPONSOR_SOCIAL_SHARES,RAISE_SHARES,RAISE_STATE_SHARES,RAISE_DOMESTIC_SHARES,RAISE_OVERSEAS_SHARES,CHANGE_REASON&quoteColumns=&filter=(SECUCODE="688192.SH")&pageNumber=1&pageSize=20&sortTypes=-1&sortColumns=END_DATE&source=HSF10&client=PC&v=06566127165296321';
                        var url=`${HQDataV2.EASTMONEY.Share.Url}?reportName=RPT_F10_EH_EQUITY&columns=${HQDataV2.EASTMONEY.Share.Columns}&quoteColumns=&filter=(SECUCODE="${upperSymbol}")&pageNumber=1&pageSize=${count}&sortTypes=-1&sortColumns=END_DATE&source=HSF10&client=PC&v=${new Date().getTime()}`;

                        const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                        const recv = await response.json();
                        
                        var recvData=HQDataV2.JosnToShareData_EASTMONEY(recv,  { Symbol:symbol });
                        if (recvData && IFrameSplitOperator.IsNonEmptyArray(recvData.Data) && recvData.Data[0])
                        {
                            var subItem=recvData.Data[0];
                            var share={};
                            stockItem.Stock.ShareCapital=share;
                            if (IFrameSplitOperator.IsNumber(subItem.Date)) share.Date=subItem.Date;
                            if (IFrameSplitOperator.IsNumber(subItem.Total)) share.Total=subItem.Total;
                            if (IFrameSplitOperator.IsNumber(subItem.ListA)) share.ListA=subItem.ListA;
                            if (IFrameSplitOperator.IsNumber(subItem.Limit)) share.Limit=subItem.Limit;
                            if (subItem.Reason) share.Reason=subItem.Reason;
                        }
                    }
                    catch(error)
                    {

                    }
                }
            }
        }
        

        return result;
    }

    static JsonToStockRealtimData_QQ(recv, symbolInfo)
    {
        if (!recv && !recv[symbolInfo.FixedSymbol]) return null;
        var aryData=recv[symbolInfo.FixedSymbol];
        var stock={ Symbol:symbolInfo.Symbol, Name:aryData[1] };
        stock.Price=HQDataV2.StringToNumber(aryData[3]);          //现价
        stock.YClose=HQDataV2.StringToNumber(aryData[4]);        //昨收
        stock.Open=HQDataV2.StringToNumber(aryData[5]);            //今开
        stock.Vol=HQDataV2.StringToNumber(aryData[6])*100;        //成交量
        stock.OutVol=HQDataV2.StringToNumber(aryData[7])*100;     //外盘
        stock.InVol=HQDataV2.StringToNumber(aryData[8])*100;      //内盘

        stock.Buys=
        [
            { Price:HQDataV2.StringToNumber(aryData[9]), Vol:HQDataV2.StringToNumber(aryData[10])*100 }, //买一
            { Price:HQDataV2.StringToNumber(aryData[11]), Vol:HQDataV2.StringToNumber(aryData[12])*100 }, //买二
            { Price:HQDataV2.StringToNumber(aryData[13]), Vol:HQDataV2.StringToNumber(aryData[14])*100 }, //买三
            { Price:HQDataV2.StringToNumber(aryData[15]), Vol:HQDataV2.StringToNumber(aryData[16])*100 }, //买四
            { Price:HQDataV2.StringToNumber(aryData[17]), Vol:HQDataV2.StringToNumber(aryData[18])*100 }  //买五
        ];

        stock.Sells=
        [
            { Price:HQDataV2.StringToNumber(aryData[19]), Vol:HQDataV2.StringToNumber(aryData[20])*100 }, //卖一
            { Price:HQDataV2.StringToNumber(aryData[21]), Vol:HQDataV2.StringToNumber(aryData[22])*100 }, //卖二
            { Price:HQDataV2.StringToNumber(aryData[23]), Vol:HQDataV2.StringToNumber(aryData[24])*100 }, //卖三
            { Price:HQDataV2.StringToNumber(aryData[25]), Vol:HQDataV2.StringToNumber(aryData[26])*100 }, //卖四
            { Price:HQDataV2.StringToNumber(aryData[27]), Vol:HQDataV2.StringToNumber(aryData[28])*100 }  //卖五
        ];

        stock.LastTrade=HQDataV2.StringToNumber(aryData[29]); //最近逐笔成交
        stock.Time=HQDataV2.StringToTimeNumber(aryData[30]); //时间
        stock.UpDown=HQDataV2.StringToNumber(aryData[31]); //涨跌
        stock.Increase=HQDataV2.StringToNumber(aryData[32]); //涨跌%
        stock.High=HQDataV2.StringToNumber(aryData[33]); //最高
        stock.Low=HQDataV2.StringToNumber(aryData[34]); //最低

        var aryValue=aryData[35].split('/');    //价格/成交量（手）/成交额
        stock.Price=HQDataV2.StringToNumber(aryValue[0]); //价格
        stock.Vol=HQDataV2.StringToNumber(aryValue[1])*100; //成交量（手）
        stock.Amount=HQDataV2.StringToNumber(aryValue[2]); //成交额
        stock.Exchange=HQDataV2.StringToNumber(aryData[38]); //换手率%
        stock.PE_TTM=HQDataV2.StringToNumber(aryData[39])   //市盈率(TTM)
        stock.Amplitude=HQDataV2.StringToNumber(aryData[43]); //振幅%
        stock.FlowMarketValue=HQDataV2.StringToNumber(aryData[44])*100000000; //流通市值(亿)
        stock.TotalMarketValue=HQDataV2.StringToNumber(aryData[45])*100000000; //总市值(亿)
        stock.PB=HQDataV2.StringToNumber(aryData[46]); //市净率
        stock.UpLimit=HQDataV2.StringToNumber(aryData[47]); //涨停价
        stock.DownLimit=HQDataV2.StringToNumber(aryData[48]); //跌停价
       
        /*
        1: 股票名字 2: 股票代码 3: 当前价格 4: 昨收 5: 今开 6: 成交量（手） 
        7: 外盘 8: 内盘 9: 买一 10: 买一量（手） 11-18: 买二 买五 19: 卖一 20: 卖一量 21-28: 卖二 卖五 
        29: 最近逐笔成交 30: 时间 31: 涨跌 32: 涨跌% 33: 最高 34: 最低 35: 价格/成交量（手）/成交额 36: 成交量（手） 37: 成交额（万） 38: 换手率 39: 市盈率 
        40: 41: 最高 42: 最低 43: 振幅 44: 流通市值 45: 总市值 46: 市净率 47: 涨停价 48: 跌停价
        */
        
        return stock
    }

    //成交明细
    static async RequestDetail_QQ(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);
            var count=50;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;

            //var url="https://proxy.finance.qq.com/ifzqgtimg/appstock/app/dealinfo/getMingxiV2?code=sz000547&limit=20&direction=1";
            var url=`${HQDataV2.QQ.Detail.Realtime.Url}?code=${fixedSymbol}&limit=${count}&direction=1`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JsonToStockDetailData_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });

                var realtimeData=await HQDataV2.RequestStockRealtimeData_SINA({Request:{ ArySymbol:[{ Symbol:symbol}]}});
                if (IFrameSplitOperator.IsNonEmptyArray(realtimeData.AryData) && realtimeData.AryData[0])
                {
                    var subItem=realtimeData.AryData[0];
                    if (subItem.Symbol==symbol && IFrameSplitOperator.IsNumber(subItem.YClose)) stockItem.YClose=subItem.YClose;
                }

                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToStockDetailData_QQ(recv, symbolInfo)
    {
        var stockItem={ Symbol:symbolInfo.Symbol, Date:null, Data:[] };
        if (!recv || !recv.data) return stockItem;

        if (recv.data.date) stockItem.Date=parseInt(recv.data.date);
        if (IFrameSplitOperator.IsNonEmptyArray(recv.data.data))
        {
            for(var i=0;i<recv.data.data.length;++i)
            {
                var item=recv.data.data[i];
                if (!item) continue;
                var aryStr=item.split("/");
                var price=parseFloat(aryStr[2]);
                var vol=parseFloat(aryStr[4]);
                var amount=parseFloat(aryStr[5]);
                var type=aryStr[6];
                var id=parseInt(aryStr[0]);
                var time=HQDataV2.StringToTimeNumber(aryStr[1]);
                var change=parseFloat(aryStr[3]);

                stockItem.Data.push({ Time:time, Price:price, Vol:vol, Amount:amount, Type:type, ID:id, PriceChange:change })
            }

            stockItem.Data.sort((left, right)=>{ return left.Time-right.Time; });
        }

        return stockItem;
    }

    static async RequestDetailV2_QQ(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);
            var detail={ Symbol:symbol, Data:[], Code:0 };
            for(var j=0;j<100;++j)
            {
                //https://stock.gtimg.cn/data/index.php?appn=detail&action=data&c=sz000547&p=67
                var url=`${HQDataV2.QQ.Detail.Full.Url}?appn=detail&action=data&c=${fixedSymbol}&p=${j}`;
                try
                {
                    const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                    const recv = await response.text();

                    var stockItem=HQDataV2.JsonToStockDetailDataV2_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                    if (!stockItem) break;

                    for(var k=0;k<stockItem.Data.length;++k)
                    {
                        detail.Data.push(stockItem.Data[k]);
                    }
                }
                catch(error)
                {
                    
                }
            }

            var realtimeData=await HQDataV2.RequestStockRealtimeData_SINA({Request:{ ArySymbol:[{ Symbol:symbol}]}});
            if (IFrameSplitOperator.IsNonEmptyArray(realtimeData.AryData) && realtimeData.AryData[0])
            {
                var subItem=realtimeData.AryData[0];
                if (subItem.Symbol==symbol && IFrameSplitOperator.IsNumber(subItem.YClose)) detail.YClose=subItem.YClose;
            }

            result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:detail, Code:0 });
        }

        return result;
    }

    static JsonToStockDetailDataV2_QQ(recv, symbolInfo)
    {
        if (!recv) return null;
        var m = recv.match(/\[\s*\d+\s*,\s*(['"])([\s\S]*?)\1\s*\]/);
        if (!m || !m[2]) return null;

        var strDetail=m[2];
        var aryTick=strDetail.split("|");
        if (!IFrameSplitOperator.IsNonEmptyArray(aryTick)) return null;

        var stockItem={ Symbol:symbolInfo.Symbol, Data:[] };
        for(var i=0, j=0;i<aryTick.length;++i)
        {
            var tickItem=aryTick[i];
            var aryStr=tickItem.split("/");
            if (!IFrameSplitOperator.IsNonEmptyArray(aryStr)) continue;

            var price=parseFloat(aryStr[2]);
            var vol=parseFloat(aryStr[4]);
            var amount=parseFloat(aryStr[5]);
            var type=aryStr[6];
            var id=parseInt(aryStr[0]);
            var time=HQDataV2.StringToTimeNumber(aryStr[1]);
            var change=parseFloat(aryStr[3]);

            stockItem.Data.push({ Time:time, Price:price, Vol:vol, Amount:amount, Type:type, ID:id, PriceChange:change })
        }


        return stockItem;
    }
    
    //分价表
    static async RequestDetailPrice_QQ(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);

            //https://stock.gtimg.cn/data/index.php?appn=price&c=sh600000&_=1765470041440
            var url=`${HQDataV2.QQ.Detail.Price.Url}?appn=price&c=${fixedSymbol}&_=${Date.now()}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.text();

                var stockItem=HQDataV2.JsonToStockDetailPriceData_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });

                var realtimeData=await HQDataV2.RequestStockRealtimeData_SINA({Request:{ ArySymbol:[{ Symbol:symbol}]}});
                if (IFrameSplitOperator.IsNonEmptyArray(realtimeData.AryData) && realtimeData.AryData[0])
                {
                    var subItem=realtimeData.AryData[0];
                    if (subItem.Symbol==symbol && IFrameSplitOperator.IsNumber(subItem.YClose)) stockItem.YClose=subItem.YClose;
                }

                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToStockDetailPriceData_QQ(recv, symbolInfo)
    {
        var stockItem={ Symbol:symbolInfo.Symbol, Data:[] };

        //[20251211,150003,10854," "]
        const regex = /^v_([a-zA-Z0-9]+)=\[(\d{8}),(\d{6}),(\d+),"([\s\S]*)"\];$/;
        const m = recv.match(regex);
        if (!m || !m[2] || !m[5]) return stockItem;
        stockItem.Date=parseInt(m[2]);
        var strDetail=m[5];
        var aryPrice=strDetail.split("^");
        var totalVol=0;
        for(var i=0;i<aryPrice.length;++i)
        {
            var strItem=aryPrice[i];
            if (!strItem) continue;
            var aryStr=strItem.split("~");

            var price=parseFloat(aryStr[0]);   //成交价格
            var vol=parseFloat(aryStr[2]);     //总成交量(手)
            var value=parseFloat(aryStr[3]); 
            var bidRate=null;                      //竞买率
            if (IFrameSplitOperator.IsNumber(value) && IFrameSplitOperator.IsPlusNumber(vol)) bidRate=value/vol*100;
            stockItem.Data.push({ Price:price, Vol:vol, BidRate:bidRate});

            if (IFrameSplitOperator.IsNumber(vol)) totalVol+=vol;
        }

        for(var i=0; i<stockItem.Data.length; ++i)  //成交占比
        {
            var item=stockItem.Data[i];
            if (IFrameSplitOperator.IsNumber(item.Vol) && IFrameSplitOperator.IsPlusNumber(totalVol)) item.Rate=item.Vol/totalVol*100;
        }

        stockItem.Data.sort((left, right)=>{ return right.Price-left.Price; })

        return stockItem;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // 新浪数据接口
    static SINA=
    {
        //实时股票数据
        Realtime:{ Url:"https://hq.sinajs.cn/" }
    }

     //代码
    static ConvertToSINASymbol(symbol)
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

    static StringToNumber(value)
    {
        var num=parseFloat(value);
        if (isNaN(num)) return null;

        return num;
    }

    static StringToDateNumber(value)
    {
        if (typeof value !== 'string') return null;
        const m = value.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/);
        if (!m) return null;
        return Number(m[1] + m[2] + m[3]);
    }

    static StringToTimeNumber(value)
    {
        if (typeof value !== 'string') return null;
        const m = value.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;
        const hh = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const ss = m[3].padStart(2, '0');
        return Number(hh + mm + ss);
    }

    static async RequestStockRealtimeData_SINA(reqData)
    {
        var result={ AryData:[] };
        var mapExtendData=new Map();    //扩展数据

        var arySymbol=reqData.Request.ArySymbol;
        var aryRequest=[], reqItem=null
        for(var i=0;i<arySymbol.length;++i)
        {
            var item=arySymbol[i];
            var fixedSymbol=HQDataV2.ConvertToSINASymbol(item.Symbol);
            if (!reqItem)
            {
                reqItem={ ArySymbol:[item.Symbol], StrSymbol:fixedSymbol };
                aryRequest.push(reqItem);
            }
            else
            {
                reqItem.ArySymbol.push(item.Symbol);
                reqItem.StrSymbol+=`,${fixedSymbol}`;
            }

            if (reqItem.ArySymbol.length>=120)
                reqItem=null;

            if (item.Fields)
            {
                if (item.Fields.MinuteClose)
                {
                    if (mapExtendData.has(item.Symbol)) mapExtendData.get(item.Symbol).MinuteClose=true;
                    else mapExtendData.set(item.Symbol, { MinuteClose:true });
                }
                else if (item.Fields.KLine && item.Fields.KLine.Count>0)
                {
                    if (mapExtendData.has(item.Symbol)) mapExtendData.get(item.Symbol).KLine=item.Fields.KLine;
                    else mapExtendData.set(item.Symbol, { KLine:item.Fields.KLine });
                }
            }
        }

        
        for(var i=0; i<aryRequest.length; ++i)
        {
            var item=aryRequest[i];
            var url=`${HQDataV2.SINA.Realtime.Url}list=${item.StrSymbol}`;
            const response= await fetch(url,{ headers:{ "content-type": "application/javascript; charset=GB18030"} } );
            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder('gb18030'); //转字符集
            const recv = decoder.decode(buffer);
            var aryData=this.JsonToStockRealtimData_SINA(recv);
            if (IFrameSplitOperator.IsNonEmptyArray(aryData)) result.AryData.push(...aryData);
        }

        if (mapExtendData.size>0)
        {
            for(var i=0;i<result.AryData.length;++i)
            {
                var stockItem=result.AryData[i];
                if (!stockItem) continue;
                if (!mapExtendData.has(stockItem.Symbol)) continue;
                var extendData=mapExtendData.get(stockItem.Symbol);

                //下载分时收盘价数据
                if (extendData.MinuteClose)
                {
                    var symbol=stockItem.Symbol;
                    var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);

                    //var url="https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz000001";
                    var url=`${HQDataV2.QQ.Minute.Url}minute/query?code=${fixedSymbol}`;

                    try
                    {
                        const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                        const recv = await response.json();

                        var minData=HQDataV2.JsonToMinuteData_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                        stockItem.Minute={ YClose:minData.YClose, Date:minData.Date, AryClose:[] };
                        for(var j=0;j<minData.Data.length;++j)
                        {
                            var minItem=minData.Data[j];
                            stockItem.Minute.AryClose.push(minItem.Price);
                        }
                    }
                    catch(error)
                    {
                       
                    }
                }

                //下载日K线数据
                if (extendData.KLine)
                {
                    var subItem=extendData.KLine;
                    var symbol=stockItem.Symbol;
                    var period=0, count=15, right=0;
                    var startDate="", endDate="";   //1999-01-01

                    if (IFrameSplitOperator.IsNumber(subItem.Count)) count=subItem.Count;
                    if (IFrameSplitOperator.IsNumber(subItem.Period)) period=subItem.Period;
                    if (IFrameSplitOperator.IsNumber(subItem.Right)) right=subItem.Right;

                    var fixedPeriod=HQDataV2.ConvertToQQPeriod(period);
                    var fixedSymbol=HQDataV2.ConvertToQQSymbol(symbol);
                    var fixedRight=HQDataV2.ConvertToQQRight(right);        
                    try
                    {
                        //var url="https://web.ifzq.gtimg.cn/appstock/app/kline/kline?_var=kline_week&param=usMSFT.OQ,week,,,320";
                        var url=`${HQDataV2.QQ.KLine.Url}newkline/newkline?param=${fixedSymbol},${fixedPeriod},${startDate},${endDate},${count}`;
                        if (right===1 || right===2) //复权
                            url=`${HQDataV2.QQ.KLine.Url}newfqkline/get?param=${fixedSymbol},${fixedPeriod},${startDate},${endDate},${count},${fixedRight}`;  
                        const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                        const recv = await response.json();
                        var kLineData=HQDataV2.JosnToKLineData_Day_QQ(recv,  { Symbol:symbol, FixedSymbol:fixedSymbol, FixedPeriod:fixedPeriod, FixedRight:fixedRight });
                        stockItem.KLine= kLineData;
                    }
                    catch(error)
                    {
                       
                    }
                }
            }
        }

        return result;
    }

    static JsonToStockRealtimData_SINA(recv)
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
                Open: HQDataV2.StringToNumber(arySrcValue[1]),
                YClose: HQDataV2.StringToNumber(arySrcValue[2]),
                Close: HQDataV2.StringToNumber(arySrcValue[3]),
                High: HQDataV2.StringToNumber(arySrcValue[4]),
                Low: HQDataV2.StringToNumber(arySrcValue[5]),

                BidPrice: HQDataV2.StringToNumber(arySrcValue[6]),   //竞买价，即“买一”报价
                AskPrice: HQDataV2.StringToNumber(arySrcValue[7]),   //竞卖价，即“卖一”报价

                Vol: HQDataV2.StringToNumber(arySrcValue[8]),               //成交量
                Amount: HQDataV2.StringToNumber(arySrcValue[9]),            //成交金额

                Buys: 
                [
                    { Vol: HQDataV2.StringToNumber(arySrcValue[10]), Price: HQDataV2.StringToNumber(arySrcValue[11]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[12]), Price: HQDataV2.StringToNumber(arySrcValue[13]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[14]), Price: HQDataV2.StringToNumber(arySrcValue[15]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[16]), Price: HQDataV2.StringToNumber(arySrcValue[17]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[18]), Price: HQDataV2.StringToNumber(arySrcValue[19]) },  
                ],
                
                Sells: 
                [
                    { Vol: HQDataV2.StringToNumber(arySrcValue[20]), Price: HQDataV2.StringToNumber(arySrcValue[21]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[22]), Price: HQDataV2.StringToNumber(arySrcValue[23]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[24]), Price: HQDataV2.StringToNumber(arySrcValue[25]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[26]), Price: HQDataV2.StringToNumber(arySrcValue[27]) },
                    { Vol: HQDataV2.StringToNumber(arySrcValue[28]), Price: HQDataV2.StringToNumber(arySrcValue[29]) },
                ], 

                Date: HQDataV2.StringToDateNumber(arySrcValue[30]),
                Time: HQDataV2.StringToTimeNumber(arySrcValue[31]),
            }

            aryStock.push(item);
        }

        return aryStock;
    }

    ////////////////////////////////////////////////////////////////////////////////////
    // 东方财富
    static EASTMONEY=
    {
        Share:{ Url:'https://datacenter.eastmoney.com/securities/api/data/v1/get', Columns:'SECUCODE,SECURITY_CODE,END_DATE,TOTAL_SHARES,LIMITED_SHARES,LIMITED_OTHARS,LIMITED_DOMESTIC_NATURAL,LIMITED_STATE_LEGAL,LIMITED_OVERSEAS_NOSTATE,LIMITED_OVERSEAS_NATURAL,UNLIMITED_SHARES,LISTED_A_SHARES,B_FREE_SHARE,H_FREE_SHARE,FREE_SHARES,LIMITED_A_SHARES,NON_FREE_SHARES,LIMITED_B_SHARES,OTHER_FREE_SHARES,LIMITED_STATE_SHARES,LIMITED_DOMESTIC_NOSTATE,LOCK_SHARES,LIMITED_FOREIGN_SHARES,LIMITED_H_SHARES,SPONSOR_SHARES,STATE_SPONSOR_SHARES,SPONSOR_SOCIAL_SHARES,RAISE_SHARES,RAISE_STATE_SHARES,RAISE_DOMESTIC_SHARES,RAISE_OVERSEAS_SHARES,CHANGE_REASON' }
    }

    //股本数据
    static async RequestShare_EASTMONEY(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol; 
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var upperSymbol=symbol.toUpperCase();
            var count=120;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;

            try
            {
                //var url='https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_F10_EH_EQUITY&columns=SECUCODE,SECURITY_CODE,END_DATE,TOTAL_SHARES,LIMITED_SHARES,LIMITED_OTHARS,LIMITED_DOMESTIC_NATURAL,LIMITED_STATE_LEGAL,LIMITED_OVERSEAS_NOSTATE,LIMITED_OVERSEAS_NATURAL,UNLIMITED_SHARES,LISTED_A_SHARES,B_FREE_SHARE,H_FREE_SHARE,FREE_SHARES,LIMITED_A_SHARES,NON_FREE_SHARES,LIMITED_B_SHARES,OTHER_FREE_SHARES,LIMITED_STATE_SHARES,LIMITED_DOMESTIC_NOSTATE,LOCK_SHARES,LIMITED_FOREIGN_SHARES,LIMITED_H_SHARES,SPONSOR_SHARES,STATE_SPONSOR_SHARES,SPONSOR_SOCIAL_SHARES,RAISE_SHARES,RAISE_STATE_SHARES,RAISE_DOMESTIC_SHARES,RAISE_OVERSEAS_SHARES,CHANGE_REASON&quoteColumns=&filter=(SECUCODE="688192.SH")&pageNumber=1&pageSize=20&sortTypes=-1&sortColumns=END_DATE&source=HSF10&client=PC&v=06566127165296321';
                var url=`${HQDataV2.EASTMONEY.Share.Url}?reportName=RPT_F10_EH_EQUITY&columns=${HQDataV2.EASTMONEY.Share.Columns}&quoteColumns=&filter=(SECUCODE="${upperSymbol}")&pageNumber=1&pageSize=${count}&sortTypes=-1&sortColumns=END_DATE&source=HSF10&client=PC&v=${new Date().getTime()}`;

                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();
                
                var stockItem=HQDataV2.JosnToShareData_EASTMONEY(recv,  { Symbol:symbol });
                if (stockItem) result.AryData.push({ Symbol:symbol, Url:url, Stock:stockItem, Code:0 });
                else result.AryData.push({ Symbol:symbol, Url:url, Code: 1});
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, Url:url, Code: 1});
            }
        }


        return result
    }

    static JosnToShareData_EASTMONEY(recv, symbolInfo)
    {
        if (recv.code!==0) return null;

        var stock={ Symbol:symbolInfo.Symbol, Data:[] };  
        if (recv && recv.result && IFrameSplitOperator.IsNonEmptyArray(recv.result.data))
        {
            var aryData=recv.result.data;
            for(var i=0;i<aryData.length;++i)
            {   
                var item=aryData[i];
                var date=HQDataV2.StringToDateNumber(item.END_DATE.split(" ")[0]);  //变动时间
                var newItem={ Date:date, Total:null, ListA:null, Limit:null, Reason:null };
                if (IFrameSplitOperator.IsNumber(item.TOTAL_SHARES)) newItem.Total=item.TOTAL_SHARES;       //总股本：股
                if (IFrameSplitOperator.IsNumber(item.LIMITED_SHARES)) newItem.Limit=item.LIMITED_SHARES;   //限售股本：股
                if (IFrameSplitOperator.IsNumber(item.LISTED_A_SHARES)) newItem.ListA=item.LISTED_A_SHARES; //流通A股股本：股
                if (item.CHANGE_REASON) newItem.Reason=item.CHANGE_REASON;                                  //变动原因
                stock.Data.push(newItem)
            }

            stock.Data.sort((left,right)=>{ return left.Date-right.Date});
        }  

        return stock;
    }
}

