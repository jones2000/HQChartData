///////////////////////////////////////////////////////////////
//  码表
//

class StockCodeList
{

    static BAIDU={ SHSZList:{ Url:"https://finance.pae.baidu.com/selfselect/getmarketrank"} };

    //http://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1812_zs&TABKEY=tab1&PAGENO=5&random=0.9125913218422376
    static SZSE={ SZIndexList:{ Url:"http://www.szse.cn/api/report/ShowReport/data"}};

    static SINA={ SHSZIndexList:{ Url:"https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeDataSimple?page=1&num=80&sort=symbol&asc=1&node=dpzs&_s_r_a=setlen"}}

    MapStock=new Map(); //key=symbol  vallue:{ Symbol, ShortSymbol, Name, Type:1=股票 }

    static GetInstance()
    {
        return g_StockCodeList;
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
}

var g_StockCodeList=new StockCodeList();