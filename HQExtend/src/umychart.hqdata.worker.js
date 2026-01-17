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

    CODE_LIST_ID:7,           //码表

    OPTION_LIST_ID:8,        //期权列表

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


class HQRequestItem
{
    Type=0;
    ID=null;
    PortID=null;

    ArySymbol=[];  //{ Symbol:, 参数: .... }

    Callback=null;     //数据到达回调
    ExtendData=null;   //扩展数据
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
            case JSCHART_DATA_TYPE_ID.CODE_LIST_ID:
            case JSCHART_DATA_TYPE_ID.OPTION_LIST_ID:
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

            case JSCHART_DATA_TYPE_ID.CODE_LIST_ID: //码表
                var reqData={ Request:item };
                this.RequestCodeList(reqData);
                break;

            case JSCHART_DATA_TYPE_ID.OPTION_LIST_ID: //期权列表
                var reqData={ Request:item };
                this.RequestOptionList(reqData);
                break;
        }
       
    }

    //历史K线
    RequestKLine(reqData)
    {
        HQDataV2.RequestKLine(reqData).then((recv)=>
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
        HQDataV2.RequestKLineMinute(reqData).then((recv)=>
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
        HQDataV2.RequestMinute(reqData).then((recv)=>
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
        HQDataV2.RequestStockRealtimeV2(reqData).then((recv)=>
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
        HQDataV2.RequestStockDetail(reqData).then((recv)=>
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


    RequestOptionList(reqData)
    {
        HQDataV2.RequestOptionList(reqData).then((recv)=>
        {
            this.RecvOptionList(recv, reqData);
        });
    }

    RecvOptionList(recv, option)
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

    RequestCodeList(reqData)
    {
        var request=reqData.Request;
        var aryData=StockCodeList.GetInstance().GetStockList();
        var data={ AryStock:aryData, Code:0 };

        this.SendHQData(request, data);
    }
}


class HQDataV2
{
    //分时图
    static async RequestMinute(reqData)
    {
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var upperSymbol=item.Symbol.toUpperCase();
            
            if (item.Cache===true)
            {
                var minData=MinuteDataCache.GetCache(item.Symbol);
                if (minData)
                {
                    result.AryData.push({ Symbol:item.Symbol, Stock:minData, Code:0 });
                    continue;
                }
            }
           
            var recvData=null;
            if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol) || MARKET_SUFFIX_NAME.IsHK(upperSymbol))
            {
                var id=HQDataV2.GetRoundID(2);  //随机去一个源请求
                if (id==0) recvData= await HQDataV2.RequestMinuteV2_QQ({Request:{ ArySymbol:[item]}});
                else recvData=await HQDataV2.RequestMinuteV2_EASTMONEY({Request:{ ArySymbol:[item]}});
                //recvData=await HQDataV2.RequestMinuteV2_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol) || MARKET_SUFFIX_NAME.IsSZO(upperSymbol))
            {
                recvData=await HQDataV2.RequestMinute_Option_SINA({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsSHFEOption(upperSymbol) || MARKET_SUFFIX_NAME.IsDCEOption(upperSymbol) || MARKET_SUFFIX_NAME.IsCZCEOption(upperSymbol))
            {
                recvData=await HQDataV2.RequestMinuteV2_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsChinaFutures(upperSymbol))
            {
                //var id=HQDataV2.GetRoundID(2);  //随机去一个源请求
                //if (id==0) recvData=await HQDataV2.RequestMinute_Futrues_SINA({Request:{ ArySymbol:[item]}});
                //else recvData=await HQDataV2.RequestMinuteV2_EASTMONEY({Request:{ ArySymbol:[item]}});

                recvData=await HQDataV2.RequestMinute_Futrues_SINA({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
            {
                recvData=await HQDataV2.RequestMinute_Stock_SINA({Request:{ ArySymbol:[item]}});
            }
            
            
            if (recvData)
            {
                result.AryData.push(...recvData.AryData);

                //缓存
                for(var j=0;j<recvData.AryData.length;++j)
                {
                    var item=recvData.AryData[j];
                    if (!item || item.Code!=0 || !item.Stock) continue;
                    MinuteDataCache.UpdateCache(item.Stock);
                }

                    
            }
        }

        return result;
    }

    //日K
    static async RequestKLine(reqData)
    {
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var upperSymbol=item.Symbol.toUpperCase();
            var recvData=null;
            if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol))
            {
                var id=HQDataV2.GetRoundID(2);  //随机去一个源请求
                if (id==0) recvData= await HQDataV2.RequestKLine_Day_QQ({Request:{ ArySymbol:[item]}});
                else recvData=await HQDataV2.RequestKLine_Day_EASTMONEY({Request:{ ArySymbol:[item]}});
                
                //recvData= await HQDataV2.RequestKLine_Day_QQ({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol) || MARKET_SUFFIX_NAME.IsChinaFutures(upperSymbol))
            {
                recvData=await HQDataV2.RequestKLine_Day_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
            {
                recvData=await HQDataV2.RequestKLine_Day_EASTMONEY({Request:{ ArySymbol:[item]}});
            }

            if (recvData)
            {
                result.AryData.push(...recvData.AryData);
            }
        }

        return result;
    }

    //分钟K线
    static async RequestKLineMinute(reqData)
    {
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var upperSymbol=item.Symbol.toUpperCase();
            var recvData=null;
            if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol))
            {
                var id=HQDataV2.GetRoundID(2);  //随机去一个源请求
                if (id==0) recvData= await HQDataV2.RequestKLine_Minute_QQ({Request:{ ArySymbol:[item]}});
                else recvData=await HQDataV2.RequestKLine_Minute_EASTMONEY({Request:{ ArySymbol:[item]}});

                //recvData=await HQDataV2.RequestKLine_Minute_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol) )
            {
                recvData=await HQDataV2.RequestKLine_Minute_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
            {
                recvData=await HQDataV2.RequestKLine_Minute_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsChinaFutures(upperSymbol))
            {
                recvData=await HQDataV2.RequestKLine_Minute_Futrues_SINA({Request:{ ArySymbol:[item]}});
            }

            if (recvData)
            {
                result.AryData.push(...recvData.AryData);
            }
        }

        return result;
    }

    static async RequestStockRealtimeV2(reqData)
    {
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        var aryQQ=[], arySINA=[];
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            if (!item || !item.Symbol) continue;
            var upperSymbol=item.Symbol.toUpperCase();
            if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol))
            {
                aryQQ.push(item);
            }
            else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol) || MARKET_SUFFIX_NAME.IsChinaFutures(upperSymbol) || MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
            {
                arySINA.push(item);
            }
        }

        if (IFrameSplitOperator.IsNonEmptyArray(aryQQ))
        {
            var recvData=await HQDataV2.RequestStockRealtimeData_QQ({ Request:{ ArySymbol:aryQQ} });
            if (recvData)
            {
                result.AryData.push(...recvData.AryData);
            }
        
        }

        if (IFrameSplitOperator.IsNonEmptyArray(arySINA))
        {
            var recvData=await HQDataV2.RequestStockRealtimeData_SINA({ Request:{ ArySymbol:arySINA} });
            if (recvData && IFrameSplitOperator.IsNonEmptyArray(recvData.AryData))
            {
                for(var i=0;i<recvData.AryData.length;++i)
                {
                    var stockItem=recvData.AryData[i];
                    result.AryData.push({ Symbol:stockItem.Symbol,  Stock:stockItem, Code:0 });
                }
                
            }
        }

        return result;
    }

    //成交明细
    static async RequestStockDetail(reqData)
    {
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var upperSymbol=item.Symbol.toUpperCase();
            var recvData=null;
            if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol))
            {
                recvData=await HQDataV2.RequestDetail_QQ({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
            {
                recvData=await HQDataV2.RequestStockDetail_SINA({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol) )
            {
                //recvData=await HQDataV2.RequestKLine_Minute_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol))
            {
                recvData=await HQDataV2.RequestOptionDetail_EASTMONEY({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsChinaFutures(upperSymbol))
            {
                recvData=await HQDataV2.RequestDetail_EASTMONEY({Request:{ ArySymbol:[item]}});
            }

            if (recvData)
            {
                result.AryData.push(...recvData.AryData);
            }
        }

        return result;
    }

    //期权列表
    static async RequestOptionList(reqData)
    {
        var result={ AryData:[] };
        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var upperSymbol=item.Symbol.toUpperCase();
            var recvData=null;
            if (MARKET_SUFFIX_NAME.IsCFFEX(upperSymbol))
            {
                recvData= await HQDataV2.RequestOptionList_SINA({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol) || MARKET_SUFFIX_NAME.IsSZO(upperSymbol))
            {
                recvData= await HQDataV2.RequestOptionList_SINA({Request:{ ArySymbol:[item]}});
            }
            else if (MARKET_SUFFIX_NAME.IsSHFE(upperSymbol) || MARKET_SUFFIX_NAME.IsDCE(upperSymbol) || MARKET_SUFFIX_NAME.IsCZCE(upperSymbol))
            {
                recvData= await HQDataV2.RequestOptionList_SINA({Request:{ ArySymbol:[item]}});
            }

            if (recvData)
            {
                result.AryData.push(...recvData.AryData);
            }
        }

        return result;
    }

    static GetRoundID(max)
    {
        var value=Math.round(Math.random()*10); 
        return value%max;
    }

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
        else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol))
        {
            fixedSymbol=`hk${JSChart.GetShortSymbol(symbol)}`;
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
            var upperSymbol=symbol.toUpperCase();

            //var url="https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz000001";
            //港股 https://web.ifzq.gtimg.cn/appstock/app/hkMinute/query?_var=min_data_hkHSI&code=hkHSI&r=0.0011752150776215275
            var url=`${HQDataV2.QQ.Minute.Url}minute/query?code=${fixedSymbol}`;
            if (MARKET_SUFFIX_NAME.IsHK(upperSymbol))
                url=`${HQDataV2.QQ.Minute.Url}hkMinute/query?code=${fixedSymbol}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JsonToMinuteData_QQ(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol) || MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
                {
                    var aryMinute=HQTradeTime.FillMinuteJsonData(stockItem.Symbol, stockItem.YClose, stockItem.Data);
                    stockItem.Data=aryMinute;
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

    static JsonToMinuteData_QQ(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        if (recv && recv.code===0 && recv.data && recv.data[symbolInfo.FixedSymbol] && recv.data[symbolInfo.FixedSymbol].data)
        {
            var stockItem=recv.data[symbolInfo.FixedSymbol];
            var date=parseInt(stockItem.data.date);
            stock.Date=date;
            var supperSymbol=stock.Symbol.toUpperCase();
            if (IFrameSplitOperator.IsNonEmptyArray(stockItem.data.data) && date>0)
            {
                var preVol=0;
                var preAmount=0;
                var volBase=1;
                if (MARKET_SUFFIX_NAME.IsSZ(supperSymbol) || MARKET_SUFFIX_NAME.IsSH(supperSymbol) ) volBase=100;
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
            var volBase=1;
            var upperSymbol=stock.Symbol.toUpperCase();
            if (MARKET_SUFFIX_NAME.IsSHSZ(upperSymbol)) volBase=100;
            if (MARKET_SUFFIX_NAME.IsSHStockSTAR(stock.Symbol)) volBase=1;
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
                    var vol=parseFloat(item[5])*volBase;    //股
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
        Realtime:{ Url:"https://hq.sinajs.cn/" },

        Option:{ CFFEX:{ Url:"https://hq.sinajs.cn/etag.php"}, SHO:{ Url:"https://hq.sinajs.cn/"} },

        //https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20minkline=/InnerFuturesNewService.getFewMinLine?symbol=AU0&type=5
        //期货分钟K线
        KLineMinute_Futrues:{ Url:"https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20minkline=/InnerFuturesNewService.getFewMinLine"},

        //https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t1nf_FU2109=/InnerFuturesNewService.getMinLine?symbol=FU2109
        Minute_Futrues:{Url:"https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t1nf_FU2109=/InnerFuturesNewService.getMinLine" },

        //https://stock.finance.sina.com.cn/futures/api/openapi.php/StockOptionDaylineService.getOptionMinline?symbol=CON_OP_10010448&random=1768229150586&callback=var%20t1CON_OP_10010448=
        Minute_Option:{ Url:"https://stock.finance.sina.com.cn/futures/api/openapi.php/StockOptionDaylineService.getOptionMinline"},
        
        //https://cn.finance.sina.com.cn/minline/getMinlineData?symbol=bj920000&version=7.11.0&callback=var%20t1bj920000=&dpc=1
        Minute_Stock:{ Url:"https://cn.finance.sina.com.cn/minline/getMinlineData"},

        Detail_Stock:{ Realtime:{ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/view/CN_TransListV2.php"} },

        Option_List:
        { 
            CFFEX:{ Url:"https://stock.finance.sina.com.cn/futures/api/openapi.php/OptionService.getOptionData"},
            SHFE:{ Url:"https://stock.finance.sina.com.cn/futures/api/openapi.php/OptionService.getOptionData"}
        }
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
        else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol))
        {
            fixedSymbol=`hk${JSChart.GetShortSymbol(symbol)}`;
        }
        else if (MARKET_SUFFIX_NAME.IsCFFEXOption(upperSymbol) || MARKET_SUFFIX_NAME.IsDCEOption(upperSymbol) || MARKET_SUFFIX_NAME.IsCZCEOption(upperSymbol))  //指数期权 https://hq.sinajs.cn/list=P_OP_io2601C4000
        {
            //MO2602-C-6300.cffex
            var aryValue=fixedSymbol.split("-");

            var strValue=aryValue[0];
            const regex = /([a-zA-Z]+)(\d+)/;
            const match = strValue.match(regex);
            
            var prefix=match[1];
            prefix=prefix.toLowerCase();

            //P_OP_io2601C4000
            fixedSymbol=`P_OP_${prefix}${match[2]}${aryValue[1]}${aryValue[2]}`;
        }
        else if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol) || MARKET_SUFFIX_NAME.IsSZO(upperSymbol)) //ETF期权
        {
            fixedSymbol=`CON_OP_${JSChart.GetShortSymbol(symbol)}`;
        }
        else if (MARKET_SUFFIX_NAME.IsSHFEOption(upperSymbol))
        {
            //m2605-C-2400.shfe
            var aryValue=fixedSymbol.split("-");

            var strValue=aryValue[0];
            const regex = /([a-zA-Z]+)(\d+)/;
            const match = strValue.match(regex);
            
            var prefix=match[1];
            prefix=prefix.toLowerCase();

            //P_OP_m2605C2400
            fixedSymbol=`P_OP_${prefix}${match[2]}${aryValue[1]}${aryValue[2]}`;
        }
        else if (MARKET_SUFFIX_NAME.IsSHFE(upperSymbol) || MARKET_SUFFIX_NAME.IsCZCE(upperSymbol) || MARKET_SUFFIX_NAME.IsDCE(upperSymbol) || MARKET_SUFFIX_NAME.IsCFFEX(upperSymbol)||
            MARKET_SUFFIX_NAME.IsGZFE(upperSymbol) || MARKET_SUFFIX_NAME.IsINE(upperSymbol))    
        {   //国内期货
            fixedSymbol=`nf_${JSChart.GetShortSymbol(symbol)}`;
        }
        else if (MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
        {
            fixedSymbol=`bj${JSChart.GetShortSymbol(symbol)}`;
        }

        return fixedSymbol;
    }

    //期货周期
    static ConvertToSINAFutruesPeriod(periodID)
    {
        var MAP_PERIOD=new Map(
        [
			[5,"5"],
			[6,"15"],
			[7,"30"],
			[8,"60"]
		]);

        return MAP_PERIOD.get(periodID);
    }
    
    //期货代码
    static ConvertToSINAFutruesSymbol(symbol)
    {
        var fixedSymbol=JSChart.GetShortSymbol(symbol);
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

    static StringToTimeNumberV2(value)
    {
        if (typeof value !== 'string') return null;
        const m = value.match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;
        const hh = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const ss = "00";
        return Number(hh + mm + ss);
    }

    //报价数据
    static async RequestStockRealtimeData_SINA(reqData)
    {
        var result={ AryData:[] };
        var mapExtendData=new Map();    //扩展数据
        var mapSymbol=new Map();        //保存内部代码跟新浪代码对应关系

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

            mapSymbol.set(fixedSymbol, { Symbol:item.Symbol, FixedSymbol:fixedSymbol });

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
            var aryData=this.JsonToStockRealtimData_SINA(recv, { MapSymbol:mapSymbol });
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
                    var minData=MinuteDataCache.GetCache(symbol);
                    if (minData)
                    {
                        stockItem.Minute={ YClose:minData.YClose, Date:minData.Date, AryClose:[] };
                        for(var j=0;j<minData.Data.length;++j)
                        {
                            var minItem=minData.Data[j];
                            stockItem.Minute.AryClose.push(minItem.Price);
                        }
                    }
                    else
                    {
                        var aryStockData=await HQDataV2.RequestMinute({ Request:{ ArySymbol:[ {Symbol:symbol} ] } });

                        try
                        {
                            if (aryStockData && IFrameSplitOperator.IsNonEmptyArray(aryStockData.AryData) && aryStockData.AryData[0])
                            {
                                var minData=aryStockData.AryData[0].Stock;
                                stockItem.Minute={ YClose:minData.YClose, Date:minData.Date, AryClose:[] };
                                for(var j=0;j<minData.Data.length;++j)
                                {
                                    var minItem=minData.Data[j];
                                    stockItem.Minute.AryClose.push(minItem.Price);
                                }
                            }

                            
                        }
                        catch(error)
                        {
                        
                        }
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

                    var aryStockData=await HQDataV2.RequestKLine({ Request:{ ArySymbol:[ {Symbol:symbol, Period:period, Right:right, Count:count } ] } });
                    
                    try
                    {
                        if (aryStockData && IFrameSplitOperator.IsNonEmptyArray(aryStockData.AryData) && aryStockData.AryData[0])
                        {
                            var klineData=aryStockData.AryData[0].Stock;
                            if (klineData.Data.length>count)
                            {
                                var startIndex=klineData.Data.length-count-1;
                                var endIndex=klineData.Data.length-1;
                                klineData.Data=klineData.Data.slice(startIndex,endIndex);
                            }

                            stockItem.KLine= klineData;
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

    static JsonToStockItem_SINA(strContent, symbolInfo)
    {
        var match = strContent.match(/(?:var|let|const)?\s*hq_str_([A-Za-z0-9_]+)\s*=\s*['"]([^'"]*)['"]/i);
        if (!match || match.length < 3) return null;
        var value=match[1];
        if (!symbolInfo.MapSymbol.has(value)) return null;

        var symbol=symbolInfo.MapSymbol.get(value).Symbol;
        var upperSymbol=symbol.toUpperCase();
        if (MARKET_SUFFIX_NAME.IsSH(upperSymbol) || MARKET_SUFFIX_NAME.IsSZ(upperSymbol) || MARKET_SUFFIX_NAME.IsBJ(upperSymbol)) 
            return HQDataV2.JsonToStockItem_StockA_SINA(symbol, strContent);
        else if (MARKET_SUFFIX_NAME.IsHK(upperSymbol)) 
            return HQDataV2.JsonToStockItem_StockHK_SINA(symbol,strContent);
        else if (MARKET_SUFFIX_NAME.IsSHFEOption(upperSymbol) || MARKET_SUFFIX_NAME.IsDCEOption(upperSymbol) || MARKET_SUFFIX_NAME.IsCZCEOption(upperSymbol))
            return HQDataV2.JsonToStockItem_SHFEOption_SINA(symbol,strContent);
        else if (MARKET_SUFFIX_NAME.IsCZCE(upperSymbol) || MARKET_SUFFIX_NAME.IsDCE(upperSymbol) || MARKET_SUFFIX_NAME.IsSHFE(upperSymbol) || 
            MARKET_SUFFIX_NAME.IsGZFE(upperSymbol) || MARKET_SUFFIX_NAME.IsINE(upperSymbol)) 
            return HQDataV2.JsonToStockItem_CNFutrues_SINA(symbol,strContent);
        else if (MARKET_SUFFIX_NAME.IsCFFEXOption(upperSymbol))
            return HQDataV2.JsonToStockItem_CFFEXOption_SINA(symbol,strContent);
        else if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol) || MARKET_SUFFIX_NAME.IsSZO(upperSymbol))
            return HQDataV2.JsonToStockItem_CFFEXOption_SINA(symbol,strContent);
        else if (MARKET_SUFFIX_NAME.IsCFFEX(upperSymbol))
            return HQDataV2.JsonToStockItem_CFFEX_SINA(symbol,strContent);
        

        return null;
    }

    //A股数据
    static JsonToStockItem_StockA_SINA(symbol, strContent)
    {
        var match = strContent.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) return null;

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
            Price: HQDataV2.StringToNumber(arySrcValue[6]),
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
        };

        if (!IFrameSplitOperator.IsPlusNumber(item.Price)) item.Price=item.Close;

        if (IFrameSplitOperator.IsNumber(item.Price) && IFrameSplitOperator.IsPlusNumber(item.YClose))
        {
            item.Increase=(item.Price-item.YClose)/item.YClose*100; //涨跌%
            item.UpDown=item.Price-item.YClose; //涨跌
        }

        if (IFrameSplitOperator.IsNumber(item.High) && IFrameSplitOperator.IsNumber(item.Low) && IFrameSplitOperator.IsPlusNumber(item.YClose))
        {
            item.Amplitude=(item.High-item.Low)/item.YClose*100;    //振幅%
        }

        return item;
    }

    //港股
    static JsonToStockItem_StockHK_SINA(symbol, strContent)
    {
        var match = strContent.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) return null;

        var strValue=match[0];
        var strValue=match[1];
        var arySrcValue=strValue.split(",");

        var item=
        {
            Symbol: symbol,
            ENName:arySrcValue[0],
            Name: arySrcValue[1],
            Open: HQDataV2.StringToNumber(arySrcValue[2]),
            YClose: HQDataV2.StringToNumber(arySrcValue[3]),
            High: HQDataV2.StringToNumber(arySrcValue[4]),
            Low: HQDataV2.StringToNumber(arySrcValue[5]),
            Close: HQDataV2.StringToNumber(arySrcValue[6]),
            Price: HQDataV2.StringToNumber(arySrcValue[6]),

            BidPrice: HQDataV2.StringToNumber(arySrcValue[9]),   //竞买价，即“买一”报价
            AskPrice: HQDataV2.StringToNumber(arySrcValue[10]),   //竞卖价，即“卖一”报价

            Vol: HQDataV2.StringToNumber(arySrcValue[12]),               //成交量
            Amount: HQDataV2.StringToNumber(arySrcValue[11]),            //成交金额

            Date: HQDataV2.StringToDateNumber(arySrcValue[17]),
            Time: HQDataV2.StringToTimeNumberV2(arySrcValue[18]),
        };

        if (IFrameSplitOperator.IsNumber(item.Price) && IFrameSplitOperator.IsPlusNumber(item.YClose))
        {
            item.Increase=(item.Price-item.YClose)/item.YClose*100; //涨跌%
            item.UpDown=item.Price-item.YClose; //涨跌
        }

        if (IFrameSplitOperator.IsNumber(item.High) && IFrameSplitOperator.IsNumber(item.Low) && IFrameSplitOperator.IsPlusNumber(item.YClose))
        {
            item.Amplitude=(item.High-item.Low)/item.YClose*100;    //振幅%
        }

        return item;
    }

    //国内期货
    static JsonToStockItem_CNFutrues_SINA(symbol, strContent)
    {
        var match = strContent.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) return null;

        var strValue=match[0];
        var strValue=match[1];
        var arySrcValue=strValue.split(",");

        var item=
        {
            Symbol: symbol,
            Name: arySrcValue[0],
            Time: parseInt(arySrcValue[1]),
            Open: HQDataV2.StringToNumber(arySrcValue[2]),
            High: HQDataV2.StringToNumber(arySrcValue[3]),
            Low: HQDataV2.StringToNumber(arySrcValue[4]),
            YClose: HQDataV2.StringToNumber(arySrcValue[5]),
            BidPrice: HQDataV2.StringToNumber(arySrcValue[6]),   //竞买价，即“买一”报价
            AskPrice: HQDataV2.StringToNumber(arySrcValue[7]),   //竞卖价，即“卖一”报价
            Close: HQDataV2.StringToNumber(arySrcValue[8]),
            Price: HQDataV2.StringToNumber(arySrcValue[8]),
            FClose:HQDataV2.StringToNumber(arySrcValue[9]),     //结算价 
            YFClose:HQDataV2.StringToNumber(arySrcValue[10]),   //昨结算 
            BidVol:HQDataV2.StringToNumber(arySrcValue[11]),    //买 量 
            AskVol:HQDataV2.StringToNumber(arySrcValue[12]),    //卖 量 
            Position: HQDataV2.StringToNumber(arySrcValue[13]),            //持仓量
            Vol: HQDataV2.StringToNumber(arySrcValue[14]),                 //成交量
            Date: HQDataV2.StringToDateNumber(arySrcValue[17]),
        };



        item.Buys=[ { Vol: item.BidVol, Price: item.BidPrice } ];
        item.Sells=[ { Vol: item.AskVol, Price: item.AskPrice } ];

        //涨跌幅=（ 现价—上一交易日结算价）/上一交易日结算价×100%
        if (IFrameSplitOperator.IsNumber(item.Price) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Increase=(item.Price-item.YFClose)/item.YFClose*100; //涨跌%
            item.UpDown=item.Price-item.YFClose; //涨跌
        }

        if (IFrameSplitOperator.IsNumber(item.High) && IFrameSplitOperator.IsNumber(item.Low) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Amplitude=(item.High-item.Low)/item.YFClose*100;    //振幅%
        }

        return item;
    }

    //中金所期货
    static JsonToStockItem_CFFEX_SINA(symbol, strContent)
    {
        var match = strContent.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) return null;

        var strValue=match[0];
        var strValue=match[1];
        var arySrcValue=strValue.split(",");

        var item=
        {
            Symbol: symbol,
            Name: arySrcValue[49],

            Open: HQDataV2.StringToNumber(arySrcValue[0]),
            High: HQDataV2.StringToNumber(arySrcValue[1]),
            Low: HQDataV2.StringToNumber(arySrcValue[2]),
            Close: HQDataV2.StringToNumber(arySrcValue[3]),
            Price: HQDataV2.StringToNumber(arySrcValue[3]),
            Vol: HQDataV2.StringToNumber(arySrcValue[4]),       //成交量
            Position: HQDataV2.StringToNumber(arySrcValue[6]),  //持仓量
            YClose: HQDataV2.StringToNumber(arySrcValue[13]),   //昨收
            YFClose:HQDataV2.StringToNumber(arySrcValue[14]),   //昨结算 

            FClose:HQDataV2.StringToNumber(arySrcValue[8]),     //结算价 ??可能
           
            BidPrice:HQDataV2.StringToNumber(arySrcValue[16]),   //竞买价，即“买一”报价
            AskPrice:HQDataV2.StringToNumber(arySrcValue[26]),   //竞卖价，即“卖一”报价

            AvPrice:HQDataV2.StringToNumber(arySrcValue[48]),    //均价
           
            BidVol:HQDataV2.StringToNumber(arySrcValue[17]),    //买 量 
            AskVol:HQDataV2.StringToNumber(arySrcValue[27]),    //卖 量 
                           
            Date: HQDataV2.StringToDateNumber(arySrcValue[36]),
            Time: HQDataV2.StringToTimeNumber(arySrcValue[37]),
        };

        item.UpLimit=HQDataV2.StringToNumber(arySrcValue[9]); //涨停价
        item.DownLimit=HQDataV2.StringToNumber(arySrcValue[10]); //跌停价

        item.Buys=[ { Vol: item.BidVol, Price: item.BidPrice } ];
        item.Sells=[ { Vol: item.AskVol, Price: item.AskPrice } ];

        //涨跌幅=（ 现价—上一交易日结算价）/上一交易日结算价×100%
        if (IFrameSplitOperator.IsNumber(item.Price) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Increase=(item.Price-item.YFClose)/item.YFClose*100; //涨跌%
            item.UpDown=item.Price-item.YFClose; //涨跌
        }

        if (IFrameSplitOperator.IsNumber(item.High) && IFrameSplitOperator.IsNumber(item.Low) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Amplitude=(item.High-item.Low)/item.YFClose*100;    //振幅%
        }

        return item;
    }

    //中金所期权
    static JsonToStockItem_CFFEXOption_SINA(symbol, strContent)
    {
        var match = strContent.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) return null;

        var strValue=match[0];
        var strValue=match[1];
        var arySrcValue=strValue.split(",");

        var item=
        {
            Symbol: symbol,
            Name: arySrcValue[37],

            BidVol:HQDataV2.StringToNumber(arySrcValue[0]),    //买 量 
            BidPrice:HQDataV2.StringToNumber(arySrcValue[1]),   //竞买价，即“买一”报价
            Close: HQDataV2.StringToNumber(arySrcValue[2]),
            Price: HQDataV2.StringToNumber(arySrcValue[2]),

            AskPrice:HQDataV2.StringToNumber(arySrcValue[3]),       //竞卖价，即“卖一”报价
            AskVol:HQDataV2.StringToNumber(arySrcValue[4]),         //卖 量 
            Position: HQDataV2.StringToNumber(arySrcValue[5]),      //持仓量
            Increase:HQDataV2.StringToNumber(arySrcValue[6]),       //涨幅
            ExePrice:HQDataV2.StringToNumber(arySrcValue[7]),        //行权价

            YClose:HQDataV2.StringToNumber(arySrcValue[8]),        //昨收
            Open: HQDataV2.StringToNumber(arySrcValue[9]),

            UpLimit:HQDataV2.StringToNumber(arySrcValue[10]),       //涨停价
            DownLimit:HQDataV2.StringToNumber(arySrcValue[11]),     //跌停价

            Amplitude:HQDataV2.StringToNumber(arySrcValue[38]),     //振幅%
            High: HQDataV2.StringToNumber(arySrcValue[39]),         //最高
            Low: HQDataV2.StringToNumber(arySrcValue[40]),          //最低
            
            Vol: HQDataV2.StringToNumber(arySrcValue[41]),       //成交量
            Amount: HQDataV2.StringToNumber(arySrcValue[42]),    //成交金额
            
            YFClose: HQDataV2.StringToNumber(arySrcValue[44]),   //昨收
            Type: arySrcValue[45],               //类型 P/C
            ReleaseDate:HQDataV2.StringToDateNumber(arySrcValue[46]),
            Days:HQDataV2.StringToNumber(arySrcValue[47]),          //剩余天数
        };

        var date=new Date(arySrcValue[32]);
        item.Date=date.getFullYear()*10000+(date.getMonth()+1)*100+date.getDate();
        item.Time=date.getHours()*10000+date.getMinutes()*100+date.getSeconds();

        item.Buys=[ { Vol: item.BidVol, Price: item.BidPrice } ];
        item.Sells=[ { Vol: item.AskVol, Price: item.AskPrice } ];

        //涨跌幅=（ 现价—上一交易日结算价）/上一交易日结算价×100%
        if (IFrameSplitOperator.IsNumber(item.Price) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Increase=(item.Price-item.YFClose)/item.YFClose*100; //涨跌%
            item.UpDown=item.Price-item.YFClose; //涨跌
        }

        if (IFrameSplitOperator.IsNumber(item.High) && IFrameSplitOperator.IsNumber(item.Low) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Amplitude=(item.High-item.Low)/item.YFClose*100;    //振幅%
        }

        return item;
    }

    //商品期权
    static JsonToStockItem_SHFEOption_SINA(symbol, strContent)
    {
        var match = strContent.match(/^(?:var|let|const)\s+\w+\s*=\s*['"](.+)['"]\s*;?$/);
        if (!match || !match[1]) return null;

        var strValue=match[0];
        var strValue=match[1];
        var arySrcValue=strValue.split(",");
        var shortSymbol=MARKET_SUFFIX_NAME.GetShortSymbol(symbol)

        var item=
        {
            Symbol: symbol,
            Name: shortSymbol,

            BidVol:HQDataV2.StringToNumber(arySrcValue[0]),    //买 量 
            BidPrice:HQDataV2.StringToNumber(arySrcValue[1]),   //竞买价，即“买一”报价
            Close: HQDataV2.StringToNumber(arySrcValue[2]),
            Price: HQDataV2.StringToNumber(arySrcValue[2]),

            AskPrice:HQDataV2.StringToNumber(arySrcValue[3]),       //竞卖价，即“卖一”报价
            AskVol:HQDataV2.StringToNumber(arySrcValue[4]),         //卖 量 
            Position: HQDataV2.StringToNumber(arySrcValue[5]),      //持仓量
            Increase:HQDataV2.StringToNumber(arySrcValue[6]),       //涨幅
            ExePrice:HQDataV2.StringToNumber(arySrcValue[7]),        //行权价

            YClose:HQDataV2.StringToNumber(arySrcValue[8]),        //昨收
            Open: HQDataV2.StringToNumber(arySrcValue[9]),

            UpLimit:HQDataV2.StringToNumber(arySrcValue[10]),       //涨停价
            DownLimit:HQDataV2.StringToNumber(arySrcValue[11]),     //跌停价

            High: HQDataV2.StringToNumber(arySrcValue[39]),         //最高
            Low: HQDataV2.StringToNumber(arySrcValue[40]),          //最低
            
            Vol: HQDataV2.StringToNumber(arySrcValue[41]),       //成交量
            Amount: HQDataV2.StringToNumber(arySrcValue[42]),    //成交金额
            
            YFClose: HQDataV2.StringToNumber(arySrcValue[44]),   //昨收
        }

        var date=new Date(arySrcValue[32]);
        item.Date=date.getFullYear()*10000+(date.getMonth()+1)*100+date.getDate();
        item.Time=date.getHours()*10000+date.getMinutes()*100+date.getSeconds();

        item.Buys=[ { Vol: item.BidVol, Price: item.BidPrice } ];
        item.Sells=[ { Vol: item.AskVol, Price: item.AskPrice } ];

        //涨跌幅=（ 现价—上一交易日结算价）/上一交易日结算价×100%
        if (IFrameSplitOperator.IsNumber(item.Price) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Increase=(item.Price-item.YFClose)/item.YFClose*100; //涨跌%
            item.UpDown=item.Price-item.YFClose; //涨跌
        }

        if (IFrameSplitOperator.IsNumber(item.High) && IFrameSplitOperator.IsNumber(item.Low) && IFrameSplitOperator.IsPlusNumber(item.YFClose))
        {
            item.Amplitude=(item.High-item.Low)/item.YFClose*100;    //振幅%
        }

        return item;
    }


    static JsonToStockRealtimData_SINA(recv, symbolInfo)
    {
        var aryStock=[];
        var aryLine=recv.split("\n");
        for(var i=0;i<aryLine.length;i++)
        {
            var text=aryLine[i];
            var item=HQDataV2.JsonToStockItem_SINA(text, symbolInfo);
            if (item) aryStock.push(item);
        }

        return aryStock;
    }

    //分钟K线数据 期货的
    static async RequestKLine_Minute_Futrues_SINA(reqData)
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

            var fixedPeriod=HQDataV2.ConvertToSINAFutruesPeriod(period);
            var fixedSymbol=HQDataV2.ConvertToSINAFutruesSymbol(symbol);

            try
            {
                //https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20minkline=/InnerFuturesNewService.getFewMinLine?symbol=AU0&type=5
                var url=`${HQDataV2.SINA.KLineMinute_Futrues.Url}?symbol=${fixedSymbol}&type=${fixedPeriod}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.text();

                var stockItem=HQDataV2.RecvKLine_Minute_Futrues_SINA(recv,  { Symbol:symbol, FixedSymbol:fixedSymbol, FixedPeriod:fixedPeriod });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static RecvKLine_Minute_Futrues_SINA(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Name:symbolInfo.FixedSymbol, Data:[] };

        const mainRegex = /(.*?)\s*=\s*\((\[.*?\])\s*\);/gs;
        const mainMatch = mainRegex.exec(recv);

        if (!mainMatch) return stock;

        var strContent = mainMatch[2].trim(); // 数组部分字符串([ { ... }, { ... } ])
        var jsonData=`{\"klines\":${strContent}}`;
        var data=JSON.parse(jsonData);
        if (!IFrameSplitOperator.IsNonEmptyArray(data.klines)) return stock;

        var yClose=null;
        for(var i=0;i<data.klines.length;++i)
        {
            var item=data.klines[i];
            var day = new Date(item.d);
            var date=day.getFullYear()*10000+(day.getMonth()+1)*100+day.getDate();
		    var time=day.getHours()*100+day.getMinutes();
            var open=parseFloat(item.o);
            var close=parseFloat(item.c);
            var high=parseFloat(item.h);
            var low=parseFloat(item.l);
            var vol=parseFloat(item.v);
            var position=parseFloat(item.p);
            var kItem={ Date:date, Time:time, YClose:yClose,  Open:open, Close:close, High:high, Low:low, Vol:vol, Amount:null, Position:position };

            yClose=close;

            stock.Data.push(kItem);
        }

        return stock;
    }

    //期货分时图
    static async RequestMinute_Futrues_SINA(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToSINAFutruesSymbol(symbol);

           
            //var url=`https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t1nf_${internalSymbol}=/InnerFuturesNewService.getMinLine?symbol=${internalSymbol}`;

            var url=`${HQDataV2.SINA.Minute_Futrues.Url}?symbol=${fixedSymbol}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.text();

                var stockItem=HQDataV2.JsonToMinuteFutruesData_SINA(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                var aryMinute=HQTradeTime.FillMinuteJsonData(stockItem.Symbol, stockItem.YClose, stockItem.Data);
                stockItem.Data=aryMinute;
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToMinuteFutruesData_SINA(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Name:symbolInfo.FixedSymbol, Data:[] };

        const mainRegex = /(.*?)\s*=\s*\((\[.*?\])\s*\);/gs;
        const mainMatch = mainRegex.exec(recv);

        if (!mainMatch) return stock;

        var strContent = mainMatch[2].trim(); // 数组部分字符串([ { ... }, { ... } ])
        var jsonData=`{\"minutes\":${strContent}}`;
        var data=JSON.parse(jsonData);
        if (!IFrameSplitOperator.IsNonEmptyArray(data.minutes)) return stock;
        var date=null, preDate=null, yClose=null;
        for(var i=0;i<data.minutes.length;++i)
        {
            var aryData=data.minutes[i];
            if (i==0)
            {
                yClose=parseFloat(aryData[5]);
                stock.YClose=yClose;
                var day = new Date(aryData[6]);
			    var date=day.getFullYear()*10000+(day.getMonth()+1)*100+day.getDate();

                //上一天
                day.setDate(day.getDate()-1); 
                preDate=day.getFullYear()*10000+(day.getMonth()+1)*100+day.getDate();
            }

            var time=parseInt(HQDataV2.StringToTimeNumberV2(aryData[0])/100);
            var price=parseFloat(aryData[1]);
            var avPrice=parseFloat(aryData[2]);
            var vol=parseFloat(aryData[3]);
            var position=parseFloat(aryData[4]);
            var minItem={ Date:date, Time:time, Price:price, Vol:vol, Amount:null, AvPrice:avPrice, Position:position };
            if (minItem.Time>2100) minItem.Date=preDate;

            stock.Data.push(minItem);
        }

        return stock;
    }

    //期权分时图
    static async RequestMinute_Option_SINA(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToSINASymbol(symbol);

            //取最新的信息
            var recvData=await HQDataV2.RequestStockRealtimeData_SINA({ Request:{ ArySymbol:[{Symbol:symbol}]} });
            var stockItem=null;
            if (!recvData || !IFrameSplitOperator.IsNonEmptyArray(recvData.AryData) && recvData.AryData[0])
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
                continue;
            }

            stockItem=recvData.AryData[0];
            
            //https://stock.finance.sina.com.cn/futures/api/openapi.php/StockOptionDaylineService.getOptionMinline?symbol=CON_OP_10010448&random=1768229150586&callback=var%20t1CON_OP_10010448=

            var url=`${HQDataV2.SINA.Minute_Option.Url}?symbol=${fixedSymbol}&random=${new Date().getTime()}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json()

                var stockItem=HQDataV2.JsonToMinuteOptionData_SINA(recv, { Symbol:symbol, FixedSymbol:fixedSymbol, Data:stockItem });
                var aryMinute=HQTradeTime.FillMinuteJsonData(stockItem.Symbol, stockItem.YClose, stockItem.Data);
                stockItem.Data=aryMinute;
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToMinuteOptionData_SINA(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Name:symbolInfo.FixedSymbol, Data:[] };

        if (!recv || !recv.result || !IFrameSplitOperator.IsNonEmptyArray(recv.result.data)) return stock;
       
        if (IFrameSplitOperator.IsNumber(symbolInfo.Data.YClose)) stock.YClose=symbolInfo.Data.YClose;
        if (IFrameSplitOperator.IsNumber(symbolInfo.Data.YFClose)) stock.YFClose=symbolInfo.Data.YFClose;
        if (IFrameSplitOperator.IsNumber(symbolInfo.Data.Date)) stock.Date=symbolInfo.Data.Date;
        if (symbolInfo.Data.Name) stock.Name=symbolInfo.Data.Name;

        var date=stock.Date;
        var aryData=recv.result.data;
        for(var i=0; i<aryData.length; ++i)
        {
            var item=aryData[i];
            if (item.d) date=HQDataV2.StringToDateNumber(item.d);

            var time=parseInt(HQDataV2.StringToTimeNumber(item.i)/100);
            var price=parseFloat(item.p);
            var avPrice=parseFloat(item.a);
            var vol=parseFloat(item.v);
            var position=parseFloat(item.t);
            var minItem={ Date:date, Time:time, Price:price, Vol:vol, Amount:null, AvPrice:avPrice, Position:position };

            stock.Data.push(minItem);
        }

        return stock;
    }


    //股票分时图
    static async RequestMinute_Stock_SINA(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToSINASymbol(symbol);

            try
            {
                var recvData=await HQDataV2.RequestStockRealtimeData_SINA({ Request:{ ArySymbol:[{Symbol:symbol}]} });
                if (recvData && IFrameSplitOperator.IsNonEmptyArray(recvData.AryData) && recvData.AryData[0])
                {
                    var baseData=recvData.AryData[0];

                    //https://cn.finance.sina.com.cn/minline/getMinlineData?symbol=bj920000&version=7.11.0&callback=var%20t1bj920000=&dpc=1
                    var url=`${HQDataV2.SINA.Minute_Stock.Url}?symbol=${fixedSymbol}&version=7.11.0&dpc=1`;
                    const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                    const recv = await response.json();

                    var stockItem=HQDataV2.JsonToMinuteStockData_SINA(recv, { Symbol:symbol, FixedSymbol:fixedSymbol, Data:baseData });
                    var aryMinute=HQTradeTime.FillMinuteJsonData(stockItem.Symbol, stockItem.YClose, stockItem.Data);
                    stockItem.Data=aryMinute;
                    result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
                }
                else
                {
                    result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
                }
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToMinuteStockData_SINA(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Name:symbolInfo.FixedSymbol, Data:[] };

        if (!recv || !recv.result || !IFrameSplitOperator.IsNonEmptyArray(recv.result.data)) return stock;
       
        if (IFrameSplitOperator.IsNumber(symbolInfo.Data.YClose)) stock.YClose=symbolInfo.Data.YClose;
        if (IFrameSplitOperator.IsNumber(symbolInfo.Data.Date)) stock.Date=symbolInfo.Data.Date;
        if (symbolInfo.Data.Name) stock.Name=symbolInfo.Data.Name;

        var date=stock.Date;
        var aryData=recv.result.data;
        var volBase=100;
        for(var i=0; i<aryData.length; ++i)
        {
            var item=aryData[i];

            var time=parseInt(HQDataV2.StringToTimeNumber(item.m)/100);
            var price=parseFloat(item.p);
            var avPrice=parseFloat(item.avg_p);
            var vol=parseFloat(item.v);
            var minItem={ Date:date, Time:time, Price:price, Vol:vol, Amount:null, AvPrice:avPrice };

            stock.Data.push(minItem);
        }

        return stock;
    }

    //成交明细
    static async RequestStockDetail_SINA(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToSINASymbol(symbol);
            var count=50;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;

            //var url="https://proxy.finance.qq.com/ifzqgtimg/appstock/app/dealinfo/getMingxiV2?code=sz000547&limit=20&direction=1";
            var url=`${HQDataV2.SINA.Detail_Stock.Realtime.Url}?num=${50}&symbol=${fixedSymbol}&rn=${new Date().getTime()}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.text();

                var stockItem=HQDataV2.JsonToStockDetailData_SINA(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });

                var realtimeData=await HQDataV2.RequestStockRealtimeData_SINA({Request:{ ArySymbol:[{ Symbol:symbol}]}});
                if (IFrameSplitOperator.IsNonEmptyArray(realtimeData.AryData) && realtimeData.AryData[0])
                {
                    var subItem=realtimeData.AryData[0];
                    if (subItem.Symbol==symbol)
                    {
                        if (IFrameSplitOperator.IsNumber(subItem.YClose)) stockItem.YClose=subItem.YClose;
                        if (IFrameSplitOperator.IsNumber(subItem.Date)) stockItem.Date=subItem.Date;
                    }
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

    static JsonToStockDetailData_SINA(recv, symbolInfo)
    {
        var stockItem={ Symbol:symbolInfo.Symbol, Date:null, Data:[] };

        const regex = /Array\(([\s\S]*?)\)/g;
        const matches = Array.from(recv.matchAll(regex));

        if (!matches || !IFrameSplitOperator.IsNonEmptyArray(matches)) return stockItem;

        for(var i=0;i<matches.length;++i)
        {
            var matchItem=matches[i];
            if (!matchItem[1]) continue;
            var strContent=matchItem[1];
            var aryStr=strContent.split(",");

            var strValue=aryStr[0].trim().replace(/^'|'$/g, '');
            var time=parseInt(HQDataV2.StringToTimeNumber(strValue));

            var strValue=aryStr[1].trim().replace(/^'|'$/g, '');
            var vol=parseFloat(strValue);

            var strValue=aryStr[2].trim().replace(/^'|'$/g, '');
            var price=parseFloat(strValue);

            var strValue=aryStr[3].trim().replace(/^'|'$/g, '');
            var type="";
            if (strValue=="UP") type="B";
            else if (strValue=="DOWN") type="S";

            stockItem.Data.push({ Time:time, Price:price, Vol:vol, Type:type, ID:time })
        }

        stockItem.Data.sort((left, right)=>{ return left.Time-right.Time; });

        return stockItem;
    }

    //期权列表
    static async RequestOptionList_SINA(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var upperSymbol=item.Symbol.toUpperCase();
            if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol) || MARKET_SUFFIX_NAME.IsSZO(upperSymbol))  //510050-2601.SHO
            {
                var shortSymbol=MARKET_SUFFIX_NAME.GetShortSymbol(upperSymbol);
                var aryValue=shortSymbol.split("-");
                var indexSymbol=aryValue[0];  //510050
                var period=aryValue[1];     //2601
                var url=`${HQDataV2.SINA.Option.SHO.Url}list=OP_UP_${indexSymbol}${period},OP_DOWN_${indexSymbol}${period},s_sh${indexSymbol}`;
                try
                {
                    const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                    const buffer = await response.arrayBuffer();
                    const decoder = new TextDecoder('gb18030'); //转字符集
                    const recv = decoder.decode(buffer);

                    var market="sh";
                    if (MARKET_SUFFIX_NAME.IsSZO(upperSymbol)) market="sz"

                    var data=await HQDataV2.JsonToSHOOptionList_SINA(recv, { Symbol:item.Symbol, IndexSymbol:`${indexSymbol}.${market}`, Market:market } );
                    if (data) result.AryData.push({ Symbol:item.Symbol, Url:url, Stock:data, Code:0 });
                    else result.AryData.push({ Symbol:item.Symbol, Url:url, Code: 1});
                }
                catch(error)
                {
                    console.warn("[HQDataV2::RequestOptionList_SINA] error", error);
                    result.AryData.push({ Symbol:item.Symbol, Url:url, Code: 1});
                }

            }
            else if (MARKET_SUFFIX_NAME.IsCFFEX(upperSymbol))
            {
                var info=MARKET_SUFFIX_NAME.SplitSymbol(item.Symbol,"A+D+");
                var product=null, period=null,  market="cffex";
                if (info)
                {
                    product=info.AryString[0].toLowerCase();
                    period=info.AryString[1];
                }

                if (item.Product) product=item.Product;
                if (item.Period) period=item.Period;
                var contract=`${product}${period}`;

                //https://stock.finance.sina.com.cn/futures/api/openapi.php/OptionService.getOptionData?type=futures&product=mo&exchange=cffex&pinzhong=mo2601
                var url=`${HQDataV2.SINA.Option_List.CFFEX.Url}?type=futures&product=${product}&exchange=${market}&pinzhong=${contract}`;
                try
                {
                    const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                    const recv = await response.json();

                    var data=HQDataV2.JsonToCFFEXOptionList_SINA(recv, { Symbol:item.Symbol } );
                    if (data) result.AryData.push({ Symbol:item.Symbol, Url:url, Stock:data, Code:0 });
                    else result.AryData.push({ Symbol:item.Symbol, Url:url, Code: 1});
                }
                catch(error)
                {
                    result.AryData.push({ Symbol:item.Symbol, Url:url, Code: 1});
                }
            }
            else if (MARKET_SUFFIX_NAME.IsSHFE(upperSymbol) || MARKET_SUFFIX_NAME.IsDCE(upperSymbol) || MARKET_SUFFIX_NAME.IsCZCE(upperSymbol))    //AL-2605
            {
                var shortSymbol=MARKET_SUFFIX_NAME.GetShortSymbol(upperSymbol);
                var aryValue=shortSymbol.split("-");
                var product=aryValue[0].toLowerCase();  //AL
                var product2="_o"
                var period=aryValue[1];     //2605


                var market="shfe";
                if (MARKET_SUFFIX_NAME.IsDCE(upperSymbol)) 
                {
                    market="dce";
                }
                else if (MARKET_SUFFIX_NAME.IsCZCE(upperSymbol)) 
                {
                    market="czce";
                    product2="";
                }

                //https://stock.finance.sina.com.cn/futures/api/openapi.php/OptionService.getOptionData?type=futures&product=zn_o&exchange=shfe&pinzhong=zn2605
                var url=`${HQDataV2.SINA.Option_List.SHFE.Url}?type=futures&product=${product}${product2}&exchange=${market}&pinzhong=${product}${period}`;
                try
                {
                    const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                    const recv = await response.json();

                    var data=HQDataV2.JsonToSHFEOptionList_SINA(recv, { Symbol:item.Symbol, Market: market } );
                    if (data) 
                    {
                        data.Underlying={ Symbol:`${aryValue[0]}0.${market}` };
                        result.AryData.push({ Symbol:item.Symbol, Url:url, Stock:data, Code:0 });
                    }
                    else result.AryData.push({ Symbol:item.Symbol, Url:url, Code: 1});
                }
                catch(error)
                {
                    result.AryData.push({ Symbol:item.Symbol, Url:url, Code: 1});
                }
            }
        }

        return result;
    }

    static JsonToSHFEOptionList_SINA(recv,symboInfo)
    {
        if (!recv || !recv.result || !recv.result.data) return null;
        var data=recv.result.data;

        var mapData=new Map();
        var result={ AryData:[], Symbol:symboInfo.Symbol };

        if (IFrameSplitOperator.IsNonEmptyArray(data.down))
        {
            for(var i=0;i<data.down.length;++i)
            {
                var item=data.down[i];
                var value=item[7];
                if (!value) continue;
               
                //zn2605P26000
                const regex = /^([a-zA-Z]+)(\d{4})([PC])(\d+)$/;
                const match = regex.exec(value);
                if (!match) continue;

                // match[1]: 字母部分
                // match[2]: 4位数字
                // match[3]: P 或 C
                // match[4]: 后面的数字  价格

                var price=parseFloat(match[4]);
                var shortSymbol=`${match[1].toUpperCase()}${match[2]}-${match[3]}-${match[4]}`;
                var symbol=`${shortSymbol}.${symboInfo.Market}`;

                if (mapData.has(price))
                {
                    var optionItem=mapData.get(price);
                    optionItem.P={ Symbol:symbol, ShortSymbol:shortSymbol };
                }
                else
                {
                    var newItem={ Price:price };
                    newItem.P={ Symbol:symbol, ShortSymbol:shortSymbol };
                    mapData.set(newItem.Price, newItem);
                }
            }
        }

        if (IFrameSplitOperator.IsNonEmptyArray(data.up))
        {
            for(var i=0;i<data.up.length;++i)
            {
                var item=data.up[i];
                var value=item[8];
                const regex = /^([a-zA-Z]+)(\d{4})([PC])(\d+)$/;
                const match = regex.exec(value);
                if (!result) continue;

                var price=parseFloat(match[4]);
                var shortSymbol=`${match[1].toUpperCase()}${match[2]}-${match[3]}-${match[4]}`;
                var symbol=`${shortSymbol}.${symboInfo.Market}`;

                if (mapData.has(price))
                {
                    var optionItem=mapData.get(price);
                    optionItem.C={ Symbol:symbol, ShortSymbol:shortSymbol };
                }
                else
                {
                    var newItem={ Price:price };
                    newItem.C={ Symbol:symbol, ShortSymbol:shortSymbol };
                    mapData.set(newItem.Price, newItem);
                }
            }
        }

        for(var [key, value] of mapData)
        {
            result.AryData.push(value);
        }

        return result;
    }


    static async JsonToSHOOptionList_SINA(recv, symboInfo)
    {
        if (!recv) return null;
        var aryLine=recv.split("\n");
        if (!IFrameSplitOperator.IsNonEmptyArray(aryLine) || aryLine.length<3) return null;
        
        var arySymbol=[];

        for(var i=0,j=0;i<aryLine.length;i++)
        {
            var text=aryLine[i];
            const regex = /var\s+([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"/g;
            var match=regex.exec(text);
            if (!match) continue;
            if (!match[1] || !match[2]) continue;

            if (i==0 || i==1)
            {
                var aryValue=match[2].split(",");
                for(var j=0;j<aryValue.length;++j)
                {
                    var value=aryValue[j];
                    var aryData=value.split("_");
                    if (aryData.length<3) continue;

                    var shortSymbol=aryData[2];
                    var symbol=`${shortSymbol}.${symboInfo.Market}o`;

                    arySymbol.push({ Symbol:symbol, ShortSymbol:shortSymbol, Type:i===0 ? "P" : "C " });
                }
            }
        }

        arySymbol.push({ Symbol:symboInfo.IndexSymbol});
        var realtimeData=await HQDataV2.RequestStockRealtimeData_SINA({ Request:{ ArySymbol:arySymbol } });
        if (!realtimeData || !IFrameSplitOperator.IsNonEmptyArray(realtimeData.AryData)) return null;

        var mapData=new Map();
        var result={ AryData:[], Symbol:symboInfo.Symbol };

        for(var i=0;i<realtimeData.AryData.length;++i)
        {
            var item=realtimeData.AryData[i];
            if (item.Type=="P" || item.Type=="C")
            {
                if (mapData.has(item.ExePrice))
                {
                    var optionItem=mapData.get(item.ExePrice);
                    if (item.Type=="P")
                    {
                        optionItem.P={ Symbol:item.Symbol, ShortSymbol:MARKET_SUFFIX_NAME.GetShortSymbol(item.Symbol) };
                    }
                    else if (item.Type=="C")
                    {
                        optionItem.C={ Symbol:item.Symbol, ShortSymbol:MARKET_SUFFIX_NAME.GetShortSymbol(item.Symbol) };
                    }
                }
                else
                {
                    var newItem={ Price:item.ExePrice };
                    if (item.Type=="P")
                    {
                        newItem.P={ Symbol:item.Symbol, ShortSymbol:MARKET_SUFFIX_NAME.GetShortSymbol(item.Symbol) };
                    }
                    else if (item.Type=="C")
                    {
                        newItem.C={ Symbol:item.Symbol, ShortSymbol:MARKET_SUFFIX_NAME.GetShortSymbol(item.Symbol) };
                    }

                    mapData.set(newItem.Price, newItem);
                }
            }
            else
            {
                result.Underlying={ Symbol:item.Symbol, Name:item.Name, Price:item.Price };
            }
        }

        for(var [key, value] of mapData)
        {
            result.AryData.push(value);
        }

        return result;
    }


    static JsonToCFFEXOptionList_SINA(recv, symboInfo)
    {
        if (!recv || !recv.result || !recv.result.data || !recv.result.data.info) return null;
        
        var mapData=new Map();
        if (IFrameSplitOperator.IsNonEmptyArray(recv.result.data.down))
        {
            var aryData=recv.result.data.down;
            for(var i=0;i<aryData.length;++i)
            {
                var item=aryData[i];
                var value=item[7]; //mo2601P6400
                //value
                var regex=/^([a-zA-Z]+)(\d+)([P|C])(\d+)$/;
                var match=regex.exec(value);
                if (!match) continue;
                
                var product=match[1];
                var period=match[2];
                var type=match[3];
                var strikePrice=parseFloat(match[4]);
                var symbol=`${product}${period}-${type}-${strikePrice}.cffex`;
                var shortSymbol=`${product}${period}-${type}-${strikePrice}`;
                
                var optionItem=null;
                if (mapData.has(strikePrice))
                {
                    var optionItem=mapData.get(strikePrice);
                    optionItem.P={ Symbol:symbol, ShortSymbol:shortSymbol };
                }
                else
                {
                    var newItem={ Price:strikePrice, P:{Symbol:symbol, ShortSymbol:shortSymbol} };
                    mapData.set(newItem.Price, newItem);
                }
            }
        }

        if (IFrameSplitOperator.IsNonEmptyArray(recv.result.data.up))
        {
            var aryData=recv.result.data.up;
            for(var i=0;i<aryData.length;++i)
            {
                var item=aryData[i];
                var value=item[8]; //mo2601C6400
                //value
                var regex=/^([a-zA-Z]+)(\d+)([P|C])(\d+)$/;
                var match=regex.exec(value);
                if (!match) continue;   
                var product=match[1];
                var period=match[2];
                var type=match[3];
                var strikePrice=parseFloat(match[4]);
                var symbol=`${product}${period}-${type}-${strikePrice}.cffex`;
                var shortSymbol=`${product}${period}-${type}-${strikePrice}`;
                var optionItem=null;
                if (mapData.has(strikePrice))
                {
                    var optionItem=mapData.get(strikePrice);
                    optionItem.C={ Symbol:symbol, ShortSymbol:shortSymbol };
                }
                else
                {
                    var newItem={ Price:strikePrice, C:{Symbol:symbol, ShortSymbol:shortSymbol} };
                    mapData.set(newItem.Price, newItem);
                }
            }
        }

        var result={ AryData:[], Symbol:symboInfo.Symbol };

        var info=recv.result.data.info;
        var value=info.relate; //sh000852
        var symbol=value;
        //正则表达式解析value
        var regex=/([a-zA-Z]+)(\d+)/;
        var match=value.match(regex);
        if (match && match[1])
        {
            symbol=`${match[2]}.${match[1]}`;
        }
        
        var name=info.realte_name;
        
        result.Name=info.name;
        result.Underlying={ Symbol:symbol, Name:name };

        for(var [key, value] of mapData)
        {
            result.AryData.push(value);
        }

        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////
    // 东方财富
    static EASTMONEY=
    {
        Share:{ Url:'https://datacenter.eastmoney.com/securities/api/data/v1/get', Columns:'SECUCODE,SECURITY_CODE,END_DATE,TOTAL_SHARES,LIMITED_SHARES,LIMITED_OTHARS,LIMITED_DOMESTIC_NATURAL,LIMITED_STATE_LEGAL,LIMITED_OVERSEAS_NOSTATE,LIMITED_OVERSEAS_NATURAL,UNLIMITED_SHARES,LISTED_A_SHARES,B_FREE_SHARE,H_FREE_SHARE,FREE_SHARES,LIMITED_A_SHARES,NON_FREE_SHARES,LIMITED_B_SHARES,OTHER_FREE_SHARES,LIMITED_STATE_SHARES,LIMITED_DOMESTIC_NOSTATE,LOCK_SHARES,LIMITED_FOREIGN_SHARES,LIMITED_H_SHARES,SPONSOR_SHARES,STATE_SPONSOR_SHARES,SPONSOR_SOCIAL_SHARES,RAISE_SHARES,RAISE_STATE_SHARES,RAISE_DOMESTIC_SHARES,RAISE_OVERSEAS_SHARES,CHANGE_REASON' },
        Minute:{ Url:"https://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58"},
        KLine:{ Url:"https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f66"},

        //成交明细
        //https://futsseapi.eastmoney.com/static/113_snm_mx/11?_=1765982894782
        Detail:{ Url:"https://futsseapi.eastmoney.com/static/" },
        //期权 成交明细
        Option_Detail:{ Url:"https://push2.eastmoney.com/api/qt/stock/details/get"}
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

                if (MARKET_SUFFIX_NAME.IsHK(upperSymbol))
                    url=`${HQDataV2.EASTMONEY.Share.Url}?reportName=RPT_HKF10_INFO_EQUITY&columns=SECUCODE%2CCHANGE_DATE%2CHK_SHARES%2CCHANGE_REASON%2CNOTICE_DATE&&quoteColumns=&filter=(SECUCODE="${upperSymbol}")&pageNumber=1&pageSize=${count}&sortTypes=-1&sortColumns=CHANGE_DATE&source=HSF10&client=PC&v=${new Date().getTime()}`;

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
        var upperSymbol = stock.Symbol.toUpperCase(); //转成大写
        if (recv && recv.result && IFrameSplitOperator.IsNonEmptyArray(recv.result.data))
        {
            var aryData=recv.result.data;
            if (MARKET_SUFFIX_NAME.IsHK(upperSymbol))
            {
                for(var i=0;i<aryData.length;++i)
                {   
                    var item=aryData[i];
                    if (!item.CHANGE_DATE) continue;
                    var date=HQDataV2.StringToDateNumber(item.CHANGE_DATE.split(" ")[0]);  //变动时间
                    var newItem={ Date:date, Total:null, ListA:null, Limit:null, Reason:null };
                    //if (IFrameSplitOperator.IsNumber(item.TOTAL_SHARES)) newItem.Total=item.TOTAL_SHARES;       //总股本：股
                    //if (IFrameSplitOperator.IsNumber(item.LIMITED_SHARES)) newItem.Limit=item.LIMITED_SHARES;   //限售股本：股
                    if (IFrameSplitOperator.IsNumber(item.HK_SHARES)) newItem.ListA=item.HK_SHARES; //流通A股股本：股
                    if (item.CHANGE_REASON) newItem.Reason=item.CHANGE_REASON;                                  //变动原因
                    stock.Data.push(newItem)
                }
            }
            else
            {
                for(var i=0;i<aryData.length;++i)
                {   
                    var item=aryData[i];
                    if (!item.END_DATE) continue;
                    var date=HQDataV2.StringToDateNumber(item.END_DATE.split(" ")[0]);  //变动时间
                    var newItem={ Date:date, Total:null, ListA:null, Limit:null, Reason:null };
                    if (IFrameSplitOperator.IsNumber(item.TOTAL_SHARES)) newItem.Total=item.TOTAL_SHARES;       //总股本：股
                    if (IFrameSplitOperator.IsNumber(item.LIMITED_SHARES)) newItem.Limit=item.LIMITED_SHARES;   //限售股本：股
                    if (IFrameSplitOperator.IsNumber(item.LISTED_A_SHARES)) newItem.ListA=item.LISTED_A_SHARES; //流通A股股本：股
                    if (item.CHANGE_REASON) newItem.Reason=item.CHANGE_REASON;                                  //变动原因
                    stock.Data.push(newItem)
                }
            }
            
            stock.Data.sort((left,right)=>{ return left.Date-right.Date});
        }  

        return stock;
    }


    static ConvertToEASTMONEYSymbol(symbol)
    {
        var upperSymbol = symbol.toLocaleUpperCase(); //转成大写
        var shortSymbol=MARKET_SUFFIX_NAME.GetShortSymbol(symbol);
        var marketID=-1;
        if (MARKET_SUFFIX_NAME.IsHK(upperSymbol))   //港股
        {
            if (IFrameSplitOperator.IsNumberString(shortSymbol)) marketID=116;  //股票
            else if (["HSI","HSCEI"].includes(shortSymbol)) marketID=100;
            else marketID=124;      //指数
        }
        else if (MARKET_SUFFIX_NAME.IsSZ(upperSymbol) || MARKET_SUFFIX_NAME.IsBJ(upperSymbol))
        {
            marketID=0;
        }
        else if (MARKET_SUFFIX_NAME.IsSH(upperSymbol))
        {
            marketID=1;
        }
        else if (MARKET_SUFFIX_NAME.IsCFFEXOption(upperSymbol)) //中金所股票期权
        {
            marketID=221;
        }
        else if (MARKET_SUFFIX_NAME.IsSHFEOption(upperSymbol))  //上期所期权
        {
            marketID=151;
            shortSymbol=shortSymbol.replaceAll("-","");
        }
        else if (MARKET_SUFFIX_NAME.IsDCEOption(upperSymbol))   //大连商品期权
        {
            marketID=140;
            shortSymbol=shortSymbol.replaceAll("-","");
        }
        else if (MARKET_SUFFIX_NAME.IsCZCEOption(upperSymbol))  //郑州期货交易所 期权
        {
            marketID=141;
            
            //郑州商品交易所 去掉前面的年份 坑~~
            var aryValue=shortSymbol.split("-");
            shortSymbol=shortSymbol.replaceAll("-","");
            var value=aryValue[0];
            const reg = /^([a-zA-Z]+)(\d+)$/;
            const matchResult = value.match(reg);
            if (matchResult)
            {
                var name=matchResult[1];
                var number=matchResult[2];
                if (number.length==4) shortSymbol=`${name}${number.slice(1)}${aryValue[1]}${aryValue[2]}`;
            }
        }
        else if (MARKET_SUFFIX_NAME.IsCFFEX(upperSymbol))
        {
            marketID=220;
        }
        else if (MARKET_SUFFIX_NAME.IsDCE(upperSymbol))
        {
            marketID=114;
        }
        else if (MARKET_SUFFIX_NAME.IsCZCE(upperSymbol))
        {
            //郑州商品交易所 去掉前面的年份 坑~~
            //核心正则：^开头 + 字母段 + 数字段 + $结尾
            const reg = /^([a-zA-Z]+)(\d+)$/;
            const matchResult = shortSymbol.match(reg);
            if (matchResult)
            {
                var name=matchResult[1];
                var number=matchResult[2];
                if (number.length==4) shortSymbol=`${name}${number.slice(1)}`;
            }

            marketID=115;
        }
        else if (MARKET_SUFFIX_NAME.IsSHFE(upperSymbol))
        {
            marketID=113;

            if (shortSymbol=="AU0") shortSymbol="aum";
               
        }
        else if (MARKET_SUFFIX_NAME.IsGZFE(upperSymbol))
        {
            marketID=225;
        }
        else if (MARKET_SUFFIX_NAME.IsINE(upperSymbol)) //上期能源
        {
            marketID=142;
        }
        else if (MARKET_SUFFIX_NAME.IsSHO(upperSymbol))
        {
            marketID=10;
        }
        else if (MARKET_SUFFIX_NAME.IsSZO(upperSymbol))
        {
            marketID=12;
        }
        

        return { MarketID:marketID, Symbol:shortSymbol };
    }

    static ConvertToEASTMONEYPeriod(periodID)
    {
        var MAP_PERIOD=new Map(
        [
            [0, 101],   //day
            [1, 102],   //week
            [2, 103],   //month

            [4, 1],    //1min
            [5, 5],    //5min
            [6, 15],   //15min
            [7, 30],   //30min
            [8, 60],   //60min
        ]);

        return MAP_PERIOD.get(periodID);
    }
    
    static ConvertToEASTMONEYRight(right)
    {
        if (right==0) return 0;
        else if (right==1) return 1;
        else return 2;
    }


     //分时图
    static async RequestMinuteV2_EASTMONEY(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToEASTMONEYSymbol(symbol);
            var dayCount=1;

            //https://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&secid=1.601006&ndays=1&iscr=0&iscca=0
            var url=`${HQDataV2.EASTMONEY.Minute.Url}&secid=${fixedSymbol.MarketID}.${fixedSymbol.Symbol}&ndays=${dayCount}&iscr=0&iscca=0`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JsonToMinuteData_EASTMONEY(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToMinuteData_EASTMONEY(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        var bStockA=MARKET_SUFFIX_NAME.IsSHSZ(symbolInfo.Symbol.toUpperCase());

        if (recv && recv.data)
        {
            var data=recv.data;
            stock.Name=data.name;
            stock.YClose=data.preClose;

            if (IFrameSplitOperator.IsNonEmptyArray(data.trends))
            {
                for(var i=0;i<data.trends.length;++i)
                {
                    var strItem=data.trends[i];
                    var item=strItem.split(',');
                    var today = new Date(Date.parse(item[0]));  
                    var date=today.getFullYear()*10000+(today.getMonth()+1)*100+today.getDate();
                    var time=today.getHours()*100+today.getMinutes();

                    var minItem=
                    { 
                        Date:date,
                        Time:time,
                        Open:parseFloat(item[1]),
                        Price:parseFloat(item[2]), 
                        High:parseFloat(item[3]),
                        Low:parseFloat(item[4]),
                        Vol:parseFloat(item[5]),
                        Amount:parseFloat(item[6]),
                        AvPrice:parseFloat(item[7]),
                    }

                    if (bStockA) minItem.Vol*=100;

                    stock.Data.push(minItem);
                }
            }
        }

        return stock;
    }

    //日K
    static async RequestKLine_Day_EASTMONEY(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var period=0, count=0, right=0;
            var start=20200101;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;
            if (IFrameSplitOperator.IsNumber(item.Period)) period=item.Period;
            if (IFrameSplitOperator.IsNumber(item.Right)) right=item.Right;

            var fixedPeriod=HQDataV2.ConvertToEASTMONEYPeriod(period);
            var fixedSymbol=HQDataV2.ConvertToEASTMONEYSymbol(symbol);
            var fixedRight=HQDataV2.ConvertToEASTMONEYRight(right);

            if (item.DateRange && item.DateRange.End && IFrameSplitOperator.IsNumber(item.DateRange.End.Date))
            {
                start=item.DateRange.End.Date;
            }
            else if (count>0)
            {
                var dayCount=count+parseInt(count/5*2)+parseInt(count/240*15);
                var nowDate=new Date();
                nowDate.setDate(nowDate.getDate()-dayCount);
                start=nowDate.getFullYear()*10000+(nowDate.getMonth()+1)*100+nowDate.getDate();
            }

            try
            {
                var url=`${HQDataV2.EASTMONEY.KLine.Url}&beg=${start}&end=20500101&ut=fa5fd1943c7b386f172d6893dbfba10b&rtntype=6&secid=${fixedSymbol.MarketID}.${fixedSymbol.Symbol}&klt=${fixedPeriod}&fqt=${fixedRight}`;

                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JosnToKLineData_Day_EASTMONEY(recv,  { Symbol:symbol, FixedSymbol:fixedSymbol, FixedPeriod:fixedPeriod, FixedRight:fixedRight });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JosnToKLineData_Day_EASTMONEY(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        if (recv && recv.data)
        {
            var data=recv.data;
            stock.Name=data.name;
            var yClose=data.preKPrice;
            var upperSymbol=null;
            if (stock.Symbol) upperSymbol=stock.Symbol.toUpperCase();
            var bFutrues=MARKET_SUFFIX_NAME.IsChinaFutures(upperSymbol);
            var volBase=1;
            if (MARKET_SUFFIX_NAME.IsSHSZ(upperSymbol) || MARKET_SUFFIX_NAME.IsBJ(upperSymbol)) volBase=100;
            if (IFrameSplitOperator.IsNonEmptyArray(data.klines))
            {
                for(var i=0;i<data.klines.length; ++i)
                {
                    var strItem=data.klines[i];
                    var item=strItem.split(',');
                    var today = new Date(Date.parse(item[0]));  
                    var date=today.getFullYear()*10000+(today.getMonth()+1)*100+today.getDate();
                
                    var open=parseFloat(item[1]);
                    var close=parseFloat(item[2]);
                    var high=parseFloat(item[3]);
                    var low=parseFloat(item[4]);
                    var vol=parseFloat(item[5])*volBase;
                    var amount=parseFloat(item[6]);
                    
                    var newItem={ Date:date, YClose:yClose,  Open:open, Close:close, High:high, Low:low, Vol:vol, Amount:amount };

                    var value=parseFloat(item[10]); //换手率
                    if (value>0 && vol>0)
                    {
                        var flowCapital=vol/value*100;
                        newItem.FlowCapital=flowCapital;    //流通股本
                    }

                    if (bFutrues) 
                    {
                        newItem.Position=parseFloat(item[11]);  //持仓
                        //newItem.FClose=parseFloat(item[12]);    //结算价
                    }
                
                    stock.Data.push(newItem);

                    yClose=close;
                }
            }

            stock.FlowCapital=true; //包含流通股本数据
        }

        return stock;
    }

    static async RequestKLine_Minute_EASTMONEY(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var period=5, count=640, right=0;
            var start=20200101;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;
            if (IFrameSplitOperator.IsNumber(item.Period)) period=item.Period;
            if (IFrameSplitOperator.IsNumber(item.Right)) right=item.Right;

            var fixedPeriod=HQDataV2.ConvertToEASTMONEYPeriod(period);
            var fixedSymbol=HQDataV2.ConvertToEASTMONEYSymbol(symbol);
            var fixedRight=HQDataV2.ConvertToEASTMONEYRight(right);

            if (item.DateRange && item.DateRange.End && IFrameSplitOperator.IsNumber(item.DateRange.End.Date))
                start=item.DateRange.End.Date;

            try
            {
                var url=`${HQDataV2.EASTMONEY.KLine.Url}&beg=${start}&end=20500101&ut=fa5fd1943c7b386f172d6893dbfba10b&rtntype=6&secid=${fixedSymbol.MarketID}.${fixedSymbol.Symbol}&klt=${fixedPeriod}&fqt=${fixedRight}`;

                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JosnToKLineData_Minute_EASTMONEY(recv,  { Symbol:symbol, FixedSymbol:fixedSymbol, FixedPeriod:fixedPeriod, FixedRight:fixedRight });
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JosnToKLineData_Minute_EASTMONEY(recv, symbolInfo)
    {
        var stock={ Symbol:symbolInfo.Symbol, Data:[] };
        if (recv && recv.data)
        {
            var data=recv.data;
            stock.Name=data.name;
            var yClose=data.preKPrice;
            if (IFrameSplitOperator.IsNonEmptyArray(data.klines))
            {
                for(var i=0;i<data.klines.length; ++i)
                {
                    var strItem=data.klines[i];
                    var item=strItem.split(',');
                    var today = new Date(Date.parse(item[0]));  
                    var date=today.getFullYear()*10000+(today.getMonth()+1)*100+today.getDate();
                    var time=today.getHours()*100+today.getMinutes();
                    var open=parseFloat(item[1]);
                    var close=parseFloat(item[2]);
                    var high=parseFloat(item[3]);
                    var low=parseFloat(item[4]);
                    var vol=parseFloat(item[5])*100;
                    var amount=parseFloat(item[6]);

                    var newItem={ Date:date, Time:time, YClose:yClose,  Open:open, Close:close, High:high, Low:low, Vol:vol, Amount:amount };

                    stock.Data.push(newItem);

                    yClose=close;
                }
            }
        }

        return stock;
    }


    //成交明细(期货)
    static async RequestDetail_EASTMONEY(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToEASTMONEYSymbol(symbol);
            var count=50;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;

            //https://futsseapi.eastmoney.com/static/113_snm_mx/11?_=1765982894782
            var url=`${HQDataV2.EASTMONEY.Detail.Url}${fixedSymbol.MarketID}_${fixedSymbol.Symbol}_mx/${count}?${new Date().getTime()}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JsonToStockDetailData_EASTMONEY(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });

                var realtimeData=await HQDataV2.RequestStockRealtimeData_SINA({Request:{ ArySymbol:[{ Symbol:symbol}]}});
                if (IFrameSplitOperator.IsNonEmptyArray(realtimeData.AryData) && realtimeData.AryData[0])
                {
                    var subItem=realtimeData.AryData[0];
                    if (subItem.Symbol==symbol)
                    {
                        if (IFrameSplitOperator.IsNumber(subItem.YClose)) stockItem.YClose=subItem.YClose;
                        if (IFrameSplitOperator.IsNumber(subItem.YFClose)) stockItem.YFClose=subItem.YFClose;
                    }
                   
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

    static JsonToStockDetailData_EASTMONEY(recv, symbolInfo)
    {
        var stockItem={ Symbol:symbolInfo.Symbol, Date:null, Data:[] };
        if (!recv || !IFrameSplitOperator.IsNonEmptyArray(recv.mx)) return stockItem;

        for(var i=0;i<recv.mx.length;++i)
        {
            var item=recv.mx[i];

            var today = new Date(item.utime*1000);  
            var date=today.getFullYear()*10000+(today.getMonth()+1)*100+today.getDate();
            var time=today.getHours()*100+today.getMinutes();
            var time2=today.getHours()*10000+today.getMinutes()*100+today.getSeconds();
            var price=item.p;
            var vol=item.vol;
            var diff=item.zcl;  //仓差(持仓变化)
            var type=item.jylx; //1 = 开仓、2 = 平仓

            //根据原始代码猜的
            //o > 0 && Math.abs(o) == c ? "双开" : o < 0 && Math.abs(o) == c ? "双平" : 1 == i && o < 0 ? "多平" : 2 == i && o < 0 ? "空平" : 2 == i && o > 0 ? "多开" : 1 == i && o > 0 ? "空开" : 2 == i && 0 == o ? "多换" : 1 == i && 0 == o ? "空换" : ""), -1, l, -1)
            var flag="";
            if (diff > 0 && Math.abs(diff) == vol) flag="双开";
            else if (diff < 0 && Math.abs(diff) == vol) flag="双平";
            else if (1 == type && diff < 0) flag="多平";
            else if (2 == type && diff < 0) flag= "空平";
            else if (2 == type && diff > 0) flag="多开";
            else if (1 == type && diff > 0) flag="空开";
            else if (2 == type && 0 == diff) flag="多换";
            else if (1 == type && 0 == diff) flag="空换";
            stockItem.Data.push({ Time:time, Time2:time2, Price:price, Vol:vol, ID:item.utime, PositionChange:diff, Type:type, Flag:flag })
        }

        stockItem.Data.sort((left, right)=>{ return left.Time2-right.Time2; });
        return stockItem;
    }

    //成交明细(期权)
    static async RequestOptionDetail_EASTMONEY(reqData)
    {
        var result={ AryData:[] };

        var arySymbol=reqData.Request.ArySymbol;
        for(var i=0; i<arySymbol.length; ++i)
        {
            var item=arySymbol[i];
            var symbol=item.Symbol;
            var fixedSymbol=HQDataV2.ConvertToEASTMONEYSymbol(symbol);
            var count=50;
            if (IFrameSplitOperator.IsNumber(item.Count)) count=item.Count;

            //https://futsseapi.eastmoney.com/static/113_snm_mx/11?_=1765982894782
            var url=`${HQDataV2.EASTMONEY.Option_Detail.Url}?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&fltt=2&pos=-${count}&secid=${fixedSymbol.MarketID}.${fixedSymbol.Symbol}&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&_=${new Date().getTime()}`;

            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var stockItem=HQDataV2.JsonToOptionDetailData_EASTMONEY(recv, { Symbol:symbol, FixedSymbol:fixedSymbol });

                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Stock:stockItem, Code:0 });
            }
            catch(error)
            {
                result.AryData.push({ Symbol:symbol, FixedSymbol:fixedSymbol, Url:url, Code: 1});
            }
        }

        return result;
    }

    static JsonToOptionDetailData_EASTMONEY(recv, symbolInfo)
    {
        var stockItem={ Symbol:symbolInfo.Symbol, Date:null, Data:[] };
        if (!recv || !recv.data || !IFrameSplitOperator.IsNonEmptyArray(recv.data.details)) return stockItem;

        for(var i=0;i<recv.data.details.length;++i)
        {
            var strContent=recv.data.details[i];
            var aryValue=strContent.split(",");

            var time2=HQDataV2.StringToTimeNumber(aryValue[0]);
            var time=parseInt(HQDataV2.StringToTimeNumber(aryValue[0])/100);
           
            var price=parseFloat(aryValue[1]);
            var vol=parseFloat(aryValue[2])
            var diff=parseFloat(aryValue[3]);  //仓差(持仓变化)
            var type=parseInt(aryValue[4]); //1 = 开仓、2 = 平仓

            //根据原始代码猜的
            //o > 0 && Math.abs(o) == c ? "双开" : o < 0 && Math.abs(o) == c ? "双平" : 1 == i && o < 0 ? "多平" : 2 == i && o < 0 ? "空平" : 2 == i && o > 0 ? "多开" : 1 == i && o > 0 ? "空开" : 2 == i && 0 == o ? "多换" : 1 == i && 0 == o ? "空换" : ""), -1, l, -1)
            var flag="";
            if (diff > 0 && Math.abs(diff) == vol) flag="双开";
            else if (diff < 0 && Math.abs(diff) == vol) flag="双平";
            else if (1 == type && diff < 0) flag="多平";
            else if (2 == type && diff < 0) flag= "空平";
            else if (2 == type && diff > 0) flag="多开";
            else if (1 == type && diff > 0) flag="空开";
            else if (2 == type && 0 == diff) flag="多换";
            else if (1 == type && 0 == diff) flag="空换";
            stockItem.Data.push({ Time:time, Time2:time2, Price:price, Vol:vol, ID:time2, PositionChange:diff, Type:type, Flag:flag })
        }

        if (IFrameSplitOperator.IsNumber(recv.data.prePrice)) stockItem.YFClose=recv.data.prePrice;

        stockItem.Data.sort((left, right)=>{ return left.Time2-right.Time2; });
        return stockItem;
    }
}

//分时图缓存
class MinuteDataCache
{
    static MapData=new Map();   //key=symbol  Value:{ Data, Time: }
    static Enable=true;
    static VaildTime=1000*60;   //数据有效时间 ms

    static GetCache(symbol)
    {
        if (!MinuteDataCache.Enable) return null;

        if (!MinuteDataCache.MapData.has(symbol)) return null;

        var item=MinuteDataCache.MapData.get(symbol);
        var now=new Date().getTime();
        if (now-item.Time>MinuteDataCache.VaildTime) //超时了 删掉
        {
            MinuteDataCache.MapData.delete(symbol);
            return null;
        }

        return item.Data;
    }

    static UpdateCache(stock)
    {
        if (!MinuteDataCache.Enable) return;
        
        MinuteDataCache.MapData.set(stock.Symbol, { Data:stock, Time:new Date().getTime() });
    }
}



//分时图交易时间区间修改
class HQTradeTime
{
    static Inital()
    {
        JSChart.GetMinuteTimeStringData().CreateSHSZData=()=>{ return HQTradeTime.CreateSHSZData(); }  //替换交易时间段
        JSChart.GetMinuteTimeStringData().CreateBJData=()=>{ return HQTradeTime.CreateSHSZData(); }
    }

    static CreateSHSZData()
    {
        var minuteStringData=JSChart.GetMinuteTimeStringData();

        const TIME_SPLIT =
        [
            { Start: 930, End: 1130 },
            { Start: 1300, End: 1500 }
        ];

        return minuteStringData.CreateTimeData(TIME_SPLIT);
    }

    //把不连续的分时数据转成连续的分时数据 (跨天的不支持) 
    static FillMinuteJsonData(symbol, yClose, aryMinute)
    {
        if (!symbol) return aryMinute;
        if (!IFrameSplitOperator.IsNonEmptyArray(aryMinute)) return aryMinute;

        var aryTime=g_MinuteTimeStringData.GetTimeData(symbol);
        if (!IFrameSplitOperator.IsNonEmptyArray(aryTime)) return aryMinute;

        
        var mapMinute=new Map();
        for(var i=0;i<aryTime.length;++i)
        {
            var time=aryTime[i];
            mapMinute.set(time, null);
        }

        for(var i=0;i<aryMinute.length;++i)
        {
            var item=aryMinute[i];
            if (!mapMinute.has(item.Time)) continue;

            mapMinute.set(item.Time, item);
        }

        var aryData=[];
        for(var mapItem of mapMinute)
        {
            var item=mapItem[1];
            var time=mapItem[0];

            if (item) aryData.push(item);
            else aryData.push({ Time:time });
        }

        for(var i=aryData.length-1;i>=0;--i)
        {
            var item=aryData[i];
            if (IFrameSplitOperator.IsNumber(item.Price))
            {
                aryData.length=i+1;
                break;
            }
        }

        var preDate=aryMinute[0].Date;
        var prePrice=yClose, preAvPrice=yClose;
        var preItem=null;
        for(var i=0; i<aryData.length; ++i)
        {
            var item=aryData[i];
            if (!IFrameSplitOperator.IsNumber(item.Price))
            {
                item.Price=prePrice;
                item.AvPrice=preAvPrice;
                item.Vol=0;
                item.Amount=null;
                item.Date=preDate;
            }
            else
            {
                prePrice=item.Price;
                preAvPrice=item.AvPrice;
                preItem=item;
                preDate=item.Date;
            }
        }

        return aryData;
    }

    
}




