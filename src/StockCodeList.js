///////////////////////////////////////////////////////////////
//  码表
//

class StockCodeList
{

    static BAIDU={ SHSZList:{ Url:"https://finance.pae.baidu.com/selfselect/getmarketrank"} };

    //http://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1812_zs&TABKEY=tab1&PAGENO=5&random=0.9125913218422376
    static SZSE={ SZIndexList:{ Url:"http://www.szse.cn/api/report/ShowReport/data"}};

    static SINA={ SHSZIndexList:{ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeDataSimple?page=1&num=80&sort=symbol&asc=1&node=dpzs&_s_r_a=setlen"}}

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
    

    MapStock=new Map(); //key=symbol  vallue:{ Symbol, ShortSymbol, Name, Type:1=股票 2=指数 3=期货  }
    SaveKey="CodeList_110C5580-6415-4B01-87B6-E6D871925773";

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

    GetStockList()
    {
        var aryData=[];
        for(var mapItem of this.MapStock)
        {
            var item=mapItem[1];
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
                var nnnn=10;
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
            if (this.MapStock.has(item.Symbol))
            {
                var stockItem=this.MapStock.get(item.Symbol);
                if (!stockItem.AryProperty) stockItem.AryProperty=[];
                stockItem.AryProperty.push({ Name:"A+H", HKSymbol:item.HKSymbol, Symbol:item.Symbol });
                
                ++result.Count;
            }

            if (this.MapStock.has(item.HKSymbol))
            {
                var stockItem=this.MapStock.get(item.HKSymbol);
                if (!stockItem.AryProperty) stockItem.AryProperty=[];
                stockItem.AryProperty.push({ Name:"A+H", HKSymbol:item.HKSymbol, Symbol:item.Symbol } );

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


}

var g_StockCodeList=new StockCodeList();