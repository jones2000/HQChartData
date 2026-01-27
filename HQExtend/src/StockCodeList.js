///////////////////////////////////////////////////////////////
//  码表
//

class StockCodeList
{

    static BAIDU={ SHSZList:{ Url:"https://finance.pae.baidu.com/selfselect/getmarketrank"} };
    

    //http://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1812_zs&TABKEY=tab1&PAGENO=5&random=0.9125913218422376
    static SZSE={ SZIndexList:{ Url:"http://www.szse.cn/api/report/ShowReport/data"}};

    static SINA=
    { 
        SHSZIndexList:{ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeDataSimple?page=1&num=80&sort=symbol&asc=1&node=dpzs&_s_r_a=setlen"},
        //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=3&num=40&sort=symbol&asc=1&node=hs_bjs&symbol=&_s_r_a=page
        BJStock:{ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData" },

        HKStockConnect:{ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"},
    };

    //中金所
    static FUTURES_CFFEX={ AryUrl:
    [
        { Url:"http://www.cffex.com.cn/quote_IF.txt", Name:"沪深" },    //	沪深300指数
        { Url:"http://www.cffex.com.cn/quote_IM.txt", Name:"中千" },     //	中证1000指数
        { Url:"http://www.cffex.com.cn/quote_IC.txt", Name:"中证" },     //	中证500指数
        { Url:"http://www.cffex.com.cn/quote_IH.txt", Name:"上证" },     //	中证500指数

        { Url:"http://www.cffex.com.cn/quote_TS.txt", Name:"二债" },     //	2年期国债期货合约
        { Url:"http://www.cffex.com.cn/quote_TF.txt", Name:"五债" },     //	5年期国债期货合约
        { Url:"http://www.cffex.com.cn/quote_T.txt", Name:"十债" },     //	10年期国债期货合约
        { Url:"http://www.cffex.com.cn/quote_TL.txt", Name:"30债" },     //	30年期国债期货合约
    ]};

    //上期所-能源
    //https://www.shfe.com.cn/data/busiparamdata/future/ContractBaseInfo20251201.dat?params=1766651277006
    static FUTURES_SHFE={ Url:"https://www.shfe.com.cn/data/busiparamdata/future"};

    //大连商品交易所
    //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQFuturesData?page=1&sort=position&asc=0&node=bz_qh&base=futures
    static FUTURES_DCE={ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQFuturesData" };


    //郑州商品交易所期货
    //https://www.czce.com.cn/cn/DFSStaticFiles/Future/2025/20251225/FutureDataDaily.txt  下午收盘以后才有当天的数据
    //https://quotation.czce.com.cn/delayed-market/trd/market/query/future/class/page?indexType=%E6%9C%9F%E8%B4%A7
    static FUTRUES_CZCE={ Url:"https://www.czce.com.cn/cn/DFSStaticFiles/Future", NameUrl:"https://quotation.czce.com.cn/delayed-market/trd/market/query/future/class/page?indexType=%E6%9C%9F%E8%B4%A7"};

    //港股通标的证券名单
    //http://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=SGT_GGTBDQD&TABKEY=tab1&PAGENO=10&random=0.2840819459449654
    static HK_STOCK_CONNECT={ Url:"http://www.szse.cn/api/report/ShowReport/data" };

    //A+H股列表
    //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=40&sort=hrap&asc=0&node=hgt_ah&_s_r_a=init
    //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=40&sort=hrap&asc=0&node=sgt_ah&_s_r_a=init
    static SHSZ_HK_STOCK=
    { 
        Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=100&sort=hrap&asc=0&node=hgt_ah&_s_r_a=init",
        Url2:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=100&sort=hrap&asc=0&node=sgt_ah&_s_r_a=init"
    };

    //美股
    static USA_STOCK=
    {  
        //中概股
        QQ:{ Url:"https://proxy.finance.qq.com/cgi/cgi-bin/rank/us/getList" } 
    };
    

    MapStock=new Map(); //key=symbol  vallue:{ Symbol, ShortSymbol, Name, Type:1=股票 2=指数 3=期货 4=期权 5=基金  }
    SaveKey="CodeList_110C5580-6415-4B01-87B6-E6D871925773";

    GetStockItem(symbol)
    {
        if (!this.MapStock.has(symbol)) return null;

        return this.MapStock.get(symbol);
    }

    static OPENCTP=
    {
        //http://openctp.cn/instruments.html
        //http://dict.openctp.cn/instruments?types=option&markets=SHFE,CFFEX
        Futrues:{ Url:"http://dict.openctp.cn/instruments" }
    }

    static GetInstance()
    {
        return g_StockCodeList;
    }

    async LoadLocalCache()
    {
        try
        {
            var localData=await chrome.storage.local.get(this.SaveKey);
            if (localData && localData[this.SaveKey])
            {
                var strContent=localData[this.SaveKey];
                var data=JSON.parse(strContent);
                if (data && IFrameSplitOperator.IsNonEmptyArray(data.Data))
                {
                    for(var i=0;i<data.Data.length;++i)
                    {
                        var item=data.Data[i];
                        this.MapStock.set(item.Key, item.Value);
                    }
                }
            }

            console.log(`[StockCodeList::Load] Count=${this.MapStock.size}`);
        }
        catch(error)
        {
            console.warn("[StockCodeList::LoadLocalCache] error", error);
        }
    }

    Save()
    {
        var strContent="";
        if (this.MapStock.size>0)
        {
            var aryData=[];
            for(var mapItem of this.MapStock)
            {
                aryData.push({Key:mapItem[0], Value:mapItem[1]})
            }
            strContent=JSON.stringify({ Data:aryData });
            console.log(`[StockCodeList::Save] Count=${aryData.length}`);
        } 

        var obj={ };
        obj[this.SaveKey]=strContent;
        chrome.storage.local.set(obj);
    }

    async Download()
    {
        await this.LoadLocalCache();

        this.DonloadUSAStock_QQ().then((res)=>
        {
            console.log(`[StockCodeList::DonloadUSAStock_QQ] Count=${res.Count}`);
        })

        this.DownloadFutruesOption_OPENCTP().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFutruesOption_OPENCTP] Count=${res.Count}`);
        });

        this.DownloadFutrues_OPENCTP().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFutrues_OPENCTP] Count=${res.Count}`);
        });

        this.DownloadFund_OPENCTP().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFund_OPENCTP] Count=${res.Count}`);
        })

        this.DownloadSHSZStock_OPENCTP().then((res)=>
        {
            console.log(`[StockCodeList::DownloadSHSZStock_OPENCTP] Count=${res.Count}`);
        })

        this.DownloadBJStock().then((res)=>
        {
            console.log(`[StockCodeList::DownloadBJStock] Count=${res.Count}`);
        });

        /*
        this.DownloadFutures_CZCE().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFutures_CZCE] Count=${res.Count}`);
        });

        this.DownloadFutures_DCE().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFutures_DCE] Count=${res.Count}`);
        });

        this.DownloadFutrues_SHFE().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFutrues_SHFE] Count=${res.Count}`);
        });

        this.DownloadFutures_CFFEX().then((res)=>
        {
            console.log(`[StockCodeList::DownloadFutures_CFFEX] Count=${res.Count}`);
        });
        */

        this.DownloadSHSZIndex().then((res)=>
        {
            console.log(`[StockCodeList::DownloadSHSZIndex] Count=${res.Count}`);
        })

        this.DownloadSZIndex().then((res)=>
        {
            console.log(`[StockCodeList::DownloadSZIndex] Count=${res.Count}`);
        });

        //顺序下载
        var result=await this.DownloadHKStockConnect();
        console.log(`[StockCodeList::DownloadHKStockConnect] Count=${result.Count}`);

        var result=await this.DownloadSHSZ();
        console.log(`[StockCodeList::DownloadSHSZ] Count=${result.Count}`);

        var result=await this.DownloadSHSZ_HK_Stock();
        console.log(`[StockCodeList::DownloadSHSZ_HK_Stock] Count=${result.Count}`);

        this.Save();
    }

    GetStockList(reqData)
    {
        var aryMarket=reqData.Request.AryMarket;
        var setType=new Set();
        if (IFrameSplitOperator.IsNonEmptyArray(aryMarket))
        {
            for(var i=0;i<aryMarket.length;++i)
            {
                var item=aryMarket[i];
                if (IFrameSplitOperator.IsNumber(item.Type))
                {
                    if (!setType.has(item.Type))  setType.add(item.Type);
                }
            }
        }

        var aryData=[];
        for(var mapItem of this.MapStock)
        {
            var item=mapItem[1];

            if (setType.size>0)
            {
                if (!setType.has(item.Type)) continue;
            }

            aryData.push(item);
        }

        return aryData;
    }

    //沪深股票
    async DownloadSHSZ()
    {
        var count=50, pageSize=200;
        var result={ Count:0 };
        for(var i=0;i<count;++i)
        {
            try
            {
                var url=`${StockCodeList.BAIDU.SHSZList.Url}?sort_type=1&sort_key=14&from_mid=1&pn=${i*pageSize}&rn=${pageSize}&group=pclist&type=ab&finClientType=pc`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var aryData=StockCodeList.JsonToStockListData_BAIDU(recv);
                if (!aryData) continue;

                if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) break;
                
                for(var j=0;j<aryData.length;++j)
                {
                    var item=aryData[j];
                    this.MapStock.set(item.Symbol, item);
                    ++result.Count;
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadSHSZ] error", error);
            }
        }

        return result;
    }


    static JsonToStockListData_BAIDU(recv)
    {
        if (!recv || recv.ResultCode!=0 || !recv.Result) return null;

        var aryData=[];
        if (!IFrameSplitOperator.IsNonEmptyArray(recv.Result.Result)) return aryData;
        var aryList=recv.Result.Result[0].DisplayData.resultData.tplData.result.rank;
        if (!IFrameSplitOperator.IsNonEmptyArray(aryList)) return aryData;

        for(var i=0;i<aryList.length;++i)
        {
            var item=aryList[i];
            var shortSymbol=item.code;
            var name=item.name;
            var symbol=null;
            var market=item.exchange;
            if (market=="SH") symbol=`${shortSymbol}.sh`;
            else if (market=="SZ") symbol=`${shortSymbol}.sz`;
            else continue;

            aryData.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:1, Market:market });
        }

        return aryData;
    }

    //北交所股票
    async DownloadBJStock()
    {
        var count=10, pageSize=40;
        var result={ Count:0 };
        for(var i=0;i<count;++i)
        {
            try
            {
                //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?" }
                var url=`${StockCodeList.SINA.BJStock.Url}?page=${i+1}&num=${pageSize}&sort=symbol&asc=1&node=hs_bjs&symbol=&_s_r_a=page`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv = await response.json();

                var aryData=StockCodeList.JsonToStockData_SINA(recv);
                if (!aryData) continue;

                if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) break;
                
                for(var j=0;j<aryData.length;++j)
                {
                    var item=aryData[j];
                    this.MapStock.set(item.Symbol, item);
                    ++result.Count;
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadBJStock] error", error);
            }
        }

        return result;
    }

    static JsonToStockData_SINA(recv)
    {
        if (!IFrameSplitOperator.IsArray(recv)) return null;

        var aryStock=[];
        if (!IFrameSplitOperator.IsNonEmptyArray(recv)) return aryStock;
       
        const pattern = /^([a-zA-Z]+)([0-9]+)$/;
        for(var i=0; i<recv.length; ++i)
        {
            var item=recv[i];
            var name=item.name;
            var shortSymbol=item.code;
            var value=item.symbol;
            var symbol=null;
            var market=null;
            const match = value.match(pattern);
            if (!match || !match[1] || !match[2]) continue;
            if (match[1]=="bj") 
            {
                symbol=`${shortSymbol}.bj`;
                market="BJ";
            }
            else 
                continue;


            aryStock.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:1, Market:market });
        }

        return aryStock;
    }

    //深证指数
    async DownloadSZIndex()
    {
        var count=5;
        var result={ Count:0 };
        for(var i=0;i<count;++i)
        {
            try
            {
                var url=`${StockCodeList.SZSE.SZIndexList.Url}?SHOWTYPE=JSON&CATALOGID=1812_zs&TABKEY=tab1&PAGENO=${i}&random=0.9125913218422376`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToSZIndexData_SZSE(recv);
                if (!aryData) continue;

                if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) break;
                
                for(var j=0;j<aryData.length;++j)
                {
                    var item=aryData[j];
                    this.MapStock.set(item.Symbol, item);
                    ++result.Count;
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadSZIndex] error", error);
            }
        }

        return result;
    }

    
    static JsonToSZIndexData_SZSE(recv)
    {
        if (!IFrameSplitOperator.IsNonEmptyArray(recv)) return null;

        var aryData=recv[0].data;
        if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) return null;

        var aryIndex=[];
        const uPattern1 = /<u>([^<]+)<\/u>/;
        for(var i=0;i<aryData.length;++i)
        {
            var item=aryData[i];
            var strValue=item.zsdm;
            var match = strValue.match(uPattern1);
            if (!match || !match[1]) continue;
            var shortSymbol=match[1];
            var symbol=`${shortSymbol}.sz`;

            strValue=item.zsmc;
            match = strValue.match(uPattern1);
            if (!match || !match[1]) continue;
            var name=match[1];

            aryIndex.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:2, Market:"SZ" });
        }

        return aryIndex;
    }

    //沪深主要指数
    async DownloadSHSZIndex()
    {
        var result={ Count:0 };
        try
        {
            var url=StockCodeList.SINA.SHSZIndexList.Url;
            const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
            const recv=await response.json();

            var aryData=StockCodeList.JsonToSHSZIndexData_SINA(recv);

            if (IFrameSplitOperator.IsNonEmptyArray(aryData))
            {
                for(var j=0;j<aryData.length;++j)
                {
                    var item=aryData[j];
                    this.MapStock.set(item.Symbol, item);
                    ++result.Count;
                }
            }
            
        }
        catch(error)
        {

        }
        

        return result;
    }

    static JsonToSHSZIndexData_SINA(recv)
    {
        if (!IFrameSplitOperator.IsNonEmptyArray(recv)) return null;

        const pattern = /^([a-zA-Z]+)([0-9]+)$/;
        var aryIndex=[];
        for(var i=0;i<recv.length;++i)
        {
            var item=recv[i];
            var name=item.name;
            var value=item.symbol;
            
            const match = value.match(pattern);
            if (!match || !match[1] || !match[2]) continue;

            var market=match[1].toUpperCase();
            var shortSymbol=match[2];
            var symbol=null;
            if (market=="SH") symbol=`${shortSymbol}.sh`;
            else if (market=="SZ") symbol=`${shortSymbol}.sz`;
            else if (market=="BJ") symbol=`${shortSymbol}.bj`;
            else continue;

            aryIndex.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:2, Market:market });
        }

        return aryIndex;
    }

    //中国金融期货交易所 期货
    async DownloadFutures_CFFEX()
    {
        var result={ Count:0 };
        for(var i=0;i<StockCodeList.FUTURES_CFFEX.AryUrl.length;++i)
        {
            var item=StockCodeList.FUTURES_CFFEX.AryUrl[i];
            try
            {
                var url=item.Url;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.text();

                var aryData=StockCodeList.JsonToFutures_CFFEX(recv, { Name:item.Name });

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }
                
            }
            catch(error)
            {

            }
        }

        return result;
    }

    static JsonToFutures_CFFEX(recv, symbolInfo)
    {
        var aryLine=recv.split("\n");
        var aryFutures=[];
        const pattern = /^([a-zA-Z]+)([0-9]+)$/;
        for(var i=1;i<aryLine.length;++i)
        {
            var strContent=aryLine[i];
            if (!strContent) continue;
            var aryData=strContent.split(",");
            if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) continue;

            var shortSymbol=aryData[0];
            var symbol=`${shortSymbol}.cffex`;
            var name=shortSymbol;
            const match = shortSymbol.match(pattern);
            if (match && match[2])
                name=`${symbolInfo.Name}${match[2]}`;

            aryFutures.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:3, Market:"CFFEX" });
        }

        return aryFutures;
    }

    //上期所, 能源
    async DownloadFutrues_SHFE()
    {
        var result={ Count:0 };
        var dateTime=new Date();
        for(var i=0; i<10; ++i)
        {
            try
            {
                var date=dateTime.getFullYear()*10000+(dateTime.getMonth()+1)*100+dateTime.getDate();
                //https://www.shfe.com.cn/data/busiparamdata/future/ContractBaseInfo20251201.dat?params=1766651277006
                var url=`${StockCodeList.FUTURES_SHFE.Url}/ContractBaseInfo${date}.dat?params=${new Date().getTime()}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToFutrues_SHFE(recv);

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }

                break;
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadFutrues_SHFE] error", error);
            }

            dateTime.setDate(dateTime.getDate()-1);
        }
        

        return result;
    }

    static JsonToFutrues_SHFE(recv)
    {
        var aryFutures=[];
        if (!recv && !IFrameSplitOperator.IsNonEmptyArray(recv.ContractBaseInfo)) return aryFutures;

        const pattern = /^([a-zA-Z]+)([0-9]+)$/;
        for(var i=0;i<recv.ContractBaseInfo.length;++i)
        {
            var item=recv.ContractBaseInfo[i];
            var shortSymbol=item.INSTRUMENTID;
            if (!shortSymbol) continue;
            shortSymbol=shortSymbol.toUpperCase();
            var typeID=item.COMMODITYID;
            typeID=typeID.toUpperCase();
            var symbol=`${shortSymbol}.shfe`;
            var market="SHFE";
            if ((["NR","SC","LU","BC","EC"].includes(typeID)))
            {
                market="INE";
                var symbol=`${shortSymbol}.ine`;
            }
           
            var name=shortSymbol;
            const match = shortSymbol.match(pattern);
            if (match && match[2] && item.COMMODITYNAME)
                name=`${item.COMMODITYNAME}${match[2]}`;
           

            aryFutures.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:3, Market:market });
        }

        return aryFutures;
    }

    //大连商品交易所
    async DownloadFutures_DCE()
    {
        var result={ Count:0 };
        const ARRAY_PARAM=
        [
            { Node:"bz_qh", Name:"纯苯" },
            { Node:"lg_qh", Name:"原木" },
            { Node:"lh_qh", Name:"生猪" },
            { Node:"pg_qh", Name:"液化石油气" },
            { Node:"byx_qh", Name:"苯乙烯" },
            { Node:"gm_qh", Name:"粳米" },
            { Node:"yec_qh", Name:"乙二醇" },
            { Node:"ymdf_qh", Name:"淀粉" },
            { Node:"jm_qh", Name:"焦煤" },
            { Node:"jt_qh", Name:"焦炭" },
            { Node:"dd_qh", Name:"豆一" },
            { Node:"hym_qh", Name:"玉米" },
            { Node:"dy_qh", Name:"豆油" },
            { Node:"jhb_qh", Name:"胶合板" },
            { Node:"xwb_qh", Name:"纤维板" },
            { Node:"jbx_qh", Name:"聚丙烯" },
            { Node:"lldpe_qh", Name:"塑料" },
            { Node:"jd_qh", Name:"鸡蛋" },
            { Node:"tks_qh", Name:"铁矿石" },
            { Node:"dp_qh", Name:"豆粕" },
            { Node:"de_qh", Name:"豆二" },
            { Node:"zly_qh", Name:"棕榈油" },
            { Node:"pvc_qh", Name:"PVC" },
        ];

        for(var i=0;i<ARRAY_PARAM.length;++i)
        {
            var item=ARRAY_PARAM[i];
            var url=`${StockCodeList.FUTURES_DCE.Url}?page=1&sort=position&asc=0&node=${item.Node}&base=futures`;
            try
            {
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToFutrues_DCE(recv, { Name:item.Name });

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadFutures_DCE] error", error);
            }
        }

        return result;
    }

    static JsonToFutrues_DCE(recv, symbolInfo)
    {
        var aryFutures=[];
        if (!IFrameSplitOperator.IsNonEmptyArray(recv)) return aryFutures;

        const pattern = /^([a-zA-Z]+)([0-9]+)$/;
        for(var i=0;i<recv.length;++i)
        {
            var item=recv[i];
            var shortSymbol=item.symbol;
            var name=shortSymbol;
            var symbol=`${shortSymbol}.dce`;

            const match = shortSymbol.match(pattern);
            if (match && match[2])
            {
                if (match[2]=='0') continue;
                name=`${symbolInfo.Name}${match[2]}`;
            }
               

            aryFutures.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:3, Market:"DCE" });
        }

        return aryFutures;
    }

    
    //郑州商品交易所期货
    async DownloadFutures_CZCE()
    {
        var result={ Count:0 };
        try
        {
            //分类名称表
            var url=StockCodeList.FUTRUES_CZCE.NameUrl;
            const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
            const recv=await response.json();

            var symbolInfo=StockCodeList.JsonToFutruesName_CZCE(recv);
            var aryData=null;
            var dateTime=new Date();
            for(var i=10;i>=0;--i)
            {
                var date=dateTime.getFullYear()*10000+(dateTime.getMonth()+1)*100+dateTime.getDate();
                //https://www.czce.com.cn/cn/DFSStaticFiles/Future/2025/20251225/FutureDataDaily.txt  下午收盘以后才有当天的数据
                var url=`${StockCodeList.FUTRUES_CZCE.Url}/${dateTime.getFullYear()}/${date}/FutureDataDaily.txt`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.text();

                aryData=StockCodeList.JsonToFutrues_CZCE(recv, symbolInfo);
                if (aryData) break;

                dateTime.setDate(dateTime.getDate()-1);
            }

            if (IFrameSplitOperator.IsNonEmptyArray(aryData))
            {
                for(var j=0;j<aryData.length;++j)
                {
                    var item=aryData[j];
                    this.MapStock.set(item.Symbol, item);
                    ++result.Count;
                }
            }
            
        }
        catch(error)
        {
            console.warn("[StockCodeList::DownloadFutures_CZCE] error", error);
        }

        return result;
    }

    static JsonToFutruesName_CZCE(recv)
    {
        var symbolInfo={ MapName:new Map(), }
        if (!recv || !recv.result) return symbolInfo;
        var aryData=recv.result.trdMarketByClassVos;
        if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) return symbolInfo;

        for(var i=0;i<aryData.length;++i)
        {
            var item=aryData[i];
            var aryValue=item.className.split(" ");
            if (!IFrameSplitOperator.IsNonEmptyArray(aryValue)) continue;

            var name=aryValue[0];
            var id=aryValue[1];
            if (!name || !id) continue;

            symbolInfo.MapName.set(id, { Name:name, ID:id });
        }

        return symbolInfo;
    }

    static JsonToFutrues_CZCE(recv, symbolInfo)
    {
        if (!recv) return null;
        if (recv.search("当日无数据")>0) return null;

        var aryLine=recv.split("\n");
        if (!IFrameSplitOperator.IsNonEmptyArray(aryLine)) return null;

        var aryFutures=[];
        const pattern = /^([a-zA-Z]+)([0-9]+)$/;
        var now=new Date();
        var year=parseInt((now.getFullYear()%100)/10);
        for(var i=0;i<aryLine.length;++i)
        {
            var strContent=aryLine[i];
            var aryValue=strContent.split("|");
            if (!IFrameSplitOperator.IsNonEmptyArray(aryValue) || aryValue.length<7) continue;

            var shortSymbol=aryValue[0];
            shortSymbol=shortSymbol.trim();

            const match = shortSymbol.match(pattern);
            if (!match || !match[2]) continue;

            var id=match[1];        //字母
            var id2=match[2];       //数字
            if (id2.length==3)      //3位数字转4位
            {
                id2=`${year}${id2}`;
                shortSymbol=`${id}${id2}`;
            }

            var name=shortSymbol;
            var symbol=`${shortSymbol}.czc`;
            if (symbolInfo && symbolInfo.MapName.has(id))
            {
                var nameItem=symbolInfo.MapName.get(id);
                name=`${nameItem.Name}${id2}`;
            }

            aryFutures.push({ Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:3, Market:"DCE" });
        }

        return aryFutures;
    }

    //港股通
    async DownloadHKStockConnect()
    {
        var result={ Count:0 };
        var count=10;
        for(var i=0;i<count;++i)
        {
            try
            {
                //http://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=SGT_GGTBDQD&TABKEY=tab1&PAGENO=10&random=0.2840819459449654
                var url=`${StockCodeList.HK_STOCK_CONNECT.Url}?SHOWTYPE=JSON&CATALOGID=SGT_GGTBDQD&TABKEY=tab1&PAGENO=${i}&random=${new Date().getTime()}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var data=StockCodeList.JsonToHKStockConnect(recv);

                if (data && IFrameSplitOperator.IsNonEmptyArray(data.AryData))
                {
                    for(var j=0;j<data.AryData.length;++j)
                    {
                        var item=data.AryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }

                    if (data.PageCount>0) count=data.PageCount;
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadHKStockConnect] error", error);
            }
        }

        return result;
    }

    static JsonToHKStockConnect(recv)
    {
        if (!recv || !recv[0]) return null;
        var aryData=recv[0].data;

        var result={ AryData:[], PageCount:-1 };
        if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) return result;
        
        for(var i=0;i<aryData.length;++i)
        {
            var item=aryData[i];
            var shortSymbol=item.zqdm;
            var symbol=`${shortSymbol}.hk`
            var name=item.zqjc;
            var enname=item.zqywjc;

            result.AryData.push({ Symbol:symbol, Name:name, ENName:enname, ShortSymbol:shortSymbol, Type:1, Market:"HK", AryProperty:[ { Name:"港股通"} ] });
        }

        if (recv[0].metadata)
        {
            var item=recv[0].metadata;
            if (IFrameSplitOperator.IsNumber(item.pagecount)) result.PageCount=item.pagecount;
        }
        
        return result;
    }

    //A+H股列表
    async DownloadSHSZ_HK_Stock()
    {
        //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=40&sort=hrap&asc=0&node=hgt_ah&_s_r_a=init
        //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=40&sort=hrap&asc=0&node=sgt_ah&_s_r_a=init

        var result={ Count:0 };
       
        try
        {
            //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=40&sort=hrap&asc=0&node=hgt_ah&_s_r_a=init
            var url=`${StockCodeList.SHSZ_HK_STOCK.Url}`;
            const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
            const recv=await response.json();

            var aryData=StockCodeList.JsonToSHSZ_HK_Stock(recv);

            this.UpdateSHSZ_HKData(aryData, result);
        }
        catch(error)
        {
            console.warn("[StockCodeList::DownloadSHSZ_HK_Stock] error", error);
        }

        try
        {
            //https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getANHData?page=1&num=40&sort=hrap&asc=0&node=sgt_ah&_s_r_a=init
            var url=`${StockCodeList.SHSZ_HK_STOCK.Url2}`;
            const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
            const recv=await response.json();

            var aryData=StockCodeList.JsonToSHSZ_HK_Stock(recv);

            this.UpdateSHSZ_HKData(aryData, result);
        }
        catch(error)
        {
            console.warn("[StockCodeList::DownloadSHSZ_HK_Stock] error", error);
        }

        return result;
    }

    UpdateSHSZ_HKData(aryData, result)
    {
        if (!IFrameSplitOperator.IsNonEmptyArray(aryData)) return;

        for(var i=0;i<aryData.length;++i)
        {
            var item=aryData[i];
            var stockItem=null, hkStockItem=null;
            if (this.MapStock.has(item.Symbol)) stockItem=this.MapStock.get(item.Symbol);
            if (this.MapStock.has(item.HKSymbol)) hkStockItem=this.MapStock.get(item.HKSymbol);

               
            if (stockItem)
            {
                var propertyItem={ Name:"A+H", SHSZ:{ Symbol:item.Symbol, Name:stockItem.Name}, HK:{ Symbol:item.HKSymbol, Name:null} };
                if (hkStockItem) propertyItem.HK.Name=hkStockItem.Name;

                if (!stockItem.AryProperty) 
                {
                    stockItem.AryProperty=[propertyItem];
                }
                else
                {
                    var bFind=false;
                    for(var j=0;j<stockItem.AryProperty.length;++j)
                    {
                        if (stockItem.AryProperty[j].Name==propertyItem.Name) 
                        {
                            stockItem.AryProperty[j]=propertyItem;
                            bFind=true;
                            break;
                        }
                    }
                    if (!bFind) stockItem.AryProperty.push(propertyItem);
                }
                
                ++result.Count;
            }
            
            if (hkStockItem)
            {
                var propertyItem={ Name:"A+H", SHSZ:{ Symbol:item.Symbol, Name:null},  HK:{ Symbol:item.HKSymbol, Name:hkStockItem.Name} };
                if (stockItem) propertyItem.SHSZ.Name=stockItem.Name;

                if (!hkStockItem.AryProperty) 
                {
                    hkStockItem.AryProperty=[];
                }
                else
                {
                    var bFind=false;
                    for(var j=0;j<hkStockItem.AryProperty.length;++j)
                    {
                        if (hkStockItem.AryProperty[j].Name==propertyItem.Name) 
                        {
                            hkStockItem.AryProperty[j]=propertyItem;
                            bFind=true;
                            break;
                        }
                    }
                    if (!bFind) hkStockItem.AryProperty.push(propertyItem);
                }
                ++result.Count;
            }
        }
        
    }

    static JsonToSHSZ_HK_Stock(recv)
    {
        var aryStock=[];
        if (!IFrameSplitOperator.IsNonEmptyArray(recv)) return aryStock;

        for(var i=0;i<recv.length;++i)
        {
            var item=recv[i];
            var hkSymbol=`${item.h}.hk`;
            var value=item.a;
            var shortSymbol=value.toUpperCase();
            var symbol=null;
            const pattern = /^([a-zA-Z]+)([0-9]+)$/;
            const match = shortSymbol.match(pattern);
            if (!match || !match[2]) continue;

            if (match[1]=='SH') symbol=`${match[2]}.sh`;
            else if (match[1]=='SZ') symbol=`${match[2]}.sz`;
            else continue;
            
            aryStock.push({ Symbol:symbol, HKSymbol:hkSymbol });
        }

        return aryStock;
    }


    //期货期权
    async DownloadFutruesOption_OPENCTP()
    {
        var result={ Count:0 };

        const MARKET_LIST=["SSE","SZSE", "CZCE","DCE","GFEX","INE","SHFE", "CFFEX" ];
        
        for(var i=0;i<MARKET_LIST.length;++i)
        {
            var market=MARKET_LIST[i];

            try
            {
                //http://dict.openctp.cn/instruments?types=option&markets=SHFE,CFFEX
                var url=`${StockCodeList.OPENCTP.Futrues.Url}?types=option&markets=${market}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToFuturesOption_OPENCTP(recv);
                if (!aryData) continue;

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadFutruesOption_OPENCTP] error", error);
            }
        }

        return result;
    }

    static JsonToFuturesOption_OPENCTP(recv)
    {
        if (!recv) return null;
        if (!IFrameSplitOperator.IsNonEmptyArray(recv.data)) return null;

        var aryData=[]
        for(var i=0;i<recv.data.length;++i)
        {
            var item=recv.data[i];
            var market=item.ExchangeID;
            var extPrice=item.StrikePrice;
            var value=item.InstrumentID; //ad2602C19100
            
            //标的
            var underlying={ Symbol:`${item.UnderlyingInstrID.toUpperCase()}.${market.toLowerCase()}` };
            var expireDate=HQDataV2.StringToDateNumber(item.ExpireDate);
            var openDate=HQDataV2.StringToDateNumber(item.OpenDate);
            var deliveryDate=HQDataV2.StringToDateNumber(item.DeliveryDate);

            if (market=="CFFEX" || market=="DCE" || market=="GFEX")
            {
                var shortSymbol=value;
                var symbol=`${shortSymbol.toUpperCase()}.${market.toLowerCase()}`;
                var product=item.ProductID;
                var aryValue=value.split("-");
                if (aryValue.length<3) continue;

                //HO2602
                var regex=/([a-zA-Z]+)(\d+)/;
                var match=value.match(regex);
                if (!match) continue;
                var period=match[2];
                var type=aryValue[1];
                product=match[1].toUpperCase();
                var name=shortSymbol;

                if (market=="CFFEX")    //股指期权 手动改下标的
                {
                    //IO 000300.sh
                    //MO 000852.sh
                    //HO 000016.sh
                    if (product=="IO") underlying.Symbol="000300.sh";
                    else if (product=="MO") underlying.Symbol="000852.sh";
                    else if (product=="HO") underlying.Symbol="000016.sh";
                }
            }
            else if (market=="CZCE")
            {
                const regex = /^([a-zA-Z]+)(\d{3})([PC])(\d+)$/;
                const match = regex.exec(value);
                if (!match) continue;

                // match[1]: 字母部分
                // match[2]: 3位数字
                // match[3]: P 或 C
                // match[4]: 后面的数字  价格

                var period=2000+parseInt(match[2])
                var product=match[1].toUpperCase();
                var shortSymbol=`${product}${period}-${match[3]}-${match[4]}`;
                var symbol=`${shortSymbol}.${market.toLowerCase()}`;
                var type=match[3];
                var name=shortSymbol;

                var info=MARKET_SUFFIX_NAME.SplitSymbol(item.UnderlyingInstrID.toUpperCase(),"A+D+");

                underlying={ Symbol:`${info.AryString[0]}2${info.AryString[1]}.${market.toLowerCase()}` };

            }
            else if (market=="SSE") //上交所
            {
                market="SH";
                var name=item.InstrumentName.trim();
                var shortSymbol=value;
                var symbol=`${value}.sho`;
                var period=`${(item.DeliveryYear%100)*100+item.DeliveryMonth}`;
                var product=`ETF`;
                var type="P";
                if (name.indexOf("购")>0) type="C";
                if (name[name.length-1]=="A") period=`${period}A`;

                underlying={ Symbol:`${item.UnderlyingInstrID.toUpperCase()}.${market.toLowerCase()}` };
            }
            else if (market=="SZSE")    //深交所
            {
                market="SZ";
                var name=item.InstrumentName.trim();
                var shortSymbol=value;
                var symbol=`${value}.szo`;
                var period=`${(item.DeliveryYear%100)*100+item.DeliveryMonth}`;
                var type="P";
                var product=`ETF`;
                if (name.indexOf("购")>0) type="C";
                if (name[name.length-1]=="A") period=`${period}A`;

                underlying={ Symbol:`${item.UnderlyingInstrID.toUpperCase()}.${market.toLowerCase()}` };
            }
            else
            {
                const regex = /^([a-zA-Z]+)(\d{4})([PC])(\d+)$/;
                const match = regex.exec(value);
                if (!match) continue;

                // match[1]: 字母部分
                // match[2]: 4位数字
                // match[3]: P 或 C
                // match[4]: 后面的数字  价格

                var product=match[1].toUpperCase();
                var shortSymbol=`${product}${match[2]}-${match[3]}-${match[4]}`;
                var symbol=`${shortSymbol}.${market.toLowerCase()}`;
                var period=match[2];
                var type=match[3];
                var name=shortSymbol;
            }

            

            aryData.push(
            { 
                Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:4, Market:market, ExePrice:extPrice,
                AryProperty:
                [ 
                    { Name:"期权信息", Option:{ Type:type, Product:product, Period:period, OpenDate:openDate, ExpireDate:expireDate, DeliveryDate:deliveryDate } }, 
                    { Name:"标的信息", Underlying:underlying }  
                ] 
            });
        }

        return aryData;
    }


    //期货
    async DownloadFutrues_OPENCTP()
    {
        var result={ Count:0 };

        const MARKET_LIST=["CZCE","DCE","GFEX","INE","SHFE", "CFFEX" ];
        
        for(var i=0;i<MARKET_LIST.length;++i)
        {
            var market=MARKET_LIST[i];

            try
            {
                //http://dict.openctp.cn/instruments?types=option&markets=SHFE,CFFEX
                var url=`${StockCodeList.OPENCTP.Futrues.Url}?types=futures&markets=${market}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToFutures_OPENCTP(recv);
                if (!aryData) continue;

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadFutruesOption_OPENCTP] error", error);
            }
        }

        return result;
    }

    static JsonToFutures_OPENCTP(recv)
    {
        if (!recv) return null;
        if (!IFrameSplitOperator.IsNonEmptyArray(recv.data)) return null;

        var aryData=[]
        for(var i=0;i<recv.data.length;++i)
        {
            var item=recv.data[i];
            var market=item.ExchangeID;
            var value=item.InstrumentID;    
            var name=item.InstrumentName;
            var product=item.ProductID;
            var expireDate=HQDataV2.StringToDateNumber(item.ExpireDate);
            var openDate=HQDataV2.StringToDateNumber(item.OpenDate);
            var deliveryDate=HQDataV2.StringToDateNumber(item.DeliveryDate);
            var shortSymbol=value.toUpperCase();

            if (market=="CZCE")
            {
                var info=MARKET_SUFFIX_NAME.SplitSymbol(value,"A+D+");
                if (info.AryString[1].length==3)      //3位数字转4位
                {
                    var shortSymbol=`${info.AryString[0]}2${info.AryString[1]}`;
                }

            }
            
            var symbol=`${shortSymbol}.${market.toLowerCase()}`;

            aryData.push(
            { 
                Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:3, Market:market,
                AryProperty:
                [ 
                    { Name:"期货信息", Futures:{ Product:product, OpenDate:openDate, ExpireDate:expireDate, DeliveryDate:deliveryDate } }, 
                ] 
            });
        }

        return aryData;
    }

    //基金
    async DownloadFund_OPENCTP()
    {
        var result={ Count:0 };

        const MARKET_LIST=["SSE","SZSE"];
        
        for(var i=0;i<MARKET_LIST.length;++i)
        {
            var market=MARKET_LIST[i];

            try
            {
                //http://dict.openctp.cn/instruments?types=option&markets=SHFE,CFFEX
                var url=`${StockCodeList.OPENCTP.Futrues.Url}?types=fund&markets=${market}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToFund_OPENCTP(recv);
                if (!aryData) continue;

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::JsonToFund_OPENCTP] error", error);
            }
        }

        return result;
    }

    static JsonToFund_OPENCTP(recv)
    {
        if (!recv) return null;
        if (!IFrameSplitOperator.IsNonEmptyArray(recv.data)) return null;

        var aryData=[]
        for(var i=0;i<recv.data.length;++i)
        {
            var item=recv.data[i];
            var market=item.ExchangeID;
            var value=item.InstrumentID;
            var name=item.InstrumentName.trim();
            var product=item.ProductID;

            if (market=="SSE") market="SH";
            else if (market=="SZSE") market="SZ";

            var shortSymbol=value;
            var symbol=`${shortSymbol}.${market.toLowerCase()}`;

            aryData.push(
            { 
                Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:5, Market:market,
                AryProperty:
                [ 
                    { Name:"基金信息", Futures:{ Type:product } }, 
                ] 
            });
        }

        return aryData;
    }

    async DownloadSHSZStock_OPENCTP()
    {
        var result={ Count:0 };

        const MARKET_LIST=["SSE","SZSE"];
        
        for(var i=0;i<MARKET_LIST.length;++i)
        {
            var market=MARKET_LIST[i];

            try
            {
                //http://dict.openctp.cn/instruments?types=option&markets=SHFE,CFFEX
                var url=`${StockCodeList.OPENCTP.Futrues.Url}?types=stock&markets=${market}`;
                const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                const recv=await response.json();

                var aryData=StockCodeList.JsonToSHSZStock_OPENCTP(recv);
                if (!aryData) continue;

                if (IFrameSplitOperator.IsNonEmptyArray(aryData))
                {
                    for(var j=0;j<aryData.length;++j)
                    {
                        var item=aryData[j];
                        this.MapStock.set(item.Symbol, item);
                        ++result.Count;
                    }
                }
            }
            catch(error)
            {
                console.warn("[StockCodeList::DownloadSHSZStock_OPENCTP] error", error);
            }
        }

        return result;
    }

    static JsonToSHSZStock_OPENCTP(recv)
    {
        if (!recv) return null;
        if (!IFrameSplitOperator.IsNonEmptyArray(recv.data)) return null;

        var aryData=[]
        for(var i=0;i<recv.data.length;++i)
        {
            var item=recv.data[i];
            var market=item.ExchangeID;
            var value=item.InstrumentID;
            var name=item.InstrumentName.trim();
            var product=item.ProductID;
            var openDate=HQDataV2.StringToDateNumber(item.OpenDate);

            if (market=="SSE") market="SH";
            else if (market=="SZSE") market="SZ";

            var shortSymbol=value;
            var symbol=`${shortSymbol}.${market.toLowerCase()}`;

            aryData.push(
            { 
                Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:1, Market:market,
                AryProperty:
                [ 
                    { Name:"股票信息", Stock:{ OpenDate:openDate } }, 
                ] 
            });
        }

        return aryData;
    }

    async DonloadUSAStock_QQ()
    {
        var result={ Count:0 };

        const STOCK_TYPE=[ {Type:"cdr", Name:"中概股"}, {Type:"tec", Name:"科技股"} ];

        for(var i=0, j=0;i<STOCK_TYPE.length;++i)
        {
            var item=STOCK_TYPE[i];

            var totalCount=300;
            var pageSize=100;
            for(j=0;j<totalCount;j+=pageSize)
            {
                try
                {
                    //https://proxy.finance.qq.com/cgi/cgi-bin/rank/us/getList?board_type=cdr&sort_type=price&direct=down&offset=0&count=20
                    var url=`${StockCodeList.USA_STOCK.QQ.Url}?board_type=${item.Type}&sort_type=price&direct=down&offset=0&${j}=${pageSize}`;
                    const response= await fetch(url, {headers:{ "content-type": "application/javascript; charset=UTF-8"}});
                    const recv=await response.json();

                    var data=StockCodeList.JsonToUSAStock_QQ(recv, item);
                    if (!data) continue;

                    if (IFrameSplitOperator.IsNonEmptyArray(data.AryData))
                    {
                        for(var k=0;k<data.AryData.length;++k)
                        {
                            var item=data.AryData[k];
                            this.MapStock.set(item.Symbol, item);
                            ++result.Count;
                        }
                    }

                    if (IFrameSplitOperator.IsNumber(data.Count)) totalCount=data.Count;
                }
                catch(error)
                {
                    console.warn("[StockCodeList::DonloadUSAStock_QQ] error", error);
                }
            }
        }

        return result;
    }

    static JsonToUSAStock_QQ(recv, option)
    {
        if (!recv || !recv.data || !IFrameSplitOperator.IsNonEmptyArray(recv.data.rank_list)) return null;

        var aryData=[];
        for(var i=0;i<recv.data.rank_list.length;++i)
        {
            var item=recv.data.rank_list[i];
            var name=item.name;
            var value=item.code;
            const regex = /(us)([a-zA-Z]+)\.([a-zA-Z]+)/;
            const matches = value.match(regex);
            if (!matches) continue;

            var shortSymbol=matches[2];
            
            var market="usa";
            if (matches[3]=="OQ") market="NSDAQ";           //美国纳斯达克证券交易所
            else if (matches[3]=="N") market="NYSE";        //美国纽约证券交易所
            else if (matches[3]=="PS") market="ANPDY";      //美国粉单市场
            else if (matches[3]=="AM") market="AMEX";       //美国证券交易所

            var symbol=`${shortSymbol}.${market.toLowerCase()}`;

            aryData.push(
            { 
                Symbol:symbol, Name:name, ShortSymbol:shortSymbol, Type:1, Market:"USA",
                AryProperty:
                [ 
                    { Name:"股票信息", Stock:{ Exchange:market } },
                    { Name:option.Name }, 
                ] 
            });
        }

        var count=null;
        if (IFrameSplitOperator.IsNumber(recv.data.total)) count=recv.data.total;
        return { AryData:aryData, Count:count };
    }
}

var g_StockCodeList=new StockCodeList();