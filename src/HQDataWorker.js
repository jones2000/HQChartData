
importScripts("../include/hqchart/umychart.js","umychart.hqdata.worker.js","RequestProxy.js")


chrome.runtime.onInstalled.addListener(({ reason }) => 
{
    if (reason === 'install') 
    {
        
    }


    var proxy=new RequestProxy();
    proxy.Instal();
});

chrome.runtime.onStartup.addListener((details)=>
{
    var proxy=new RequestProxy();
    proxy.Instal();
})


var g_HQChartDataService=new HQChartDataService();
g_HQChartDataService.Create();


/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.KLINE_MIN_DATA_ID;
item.ArySymbol=[{ Symbol:"AU0.shfe" }, { Symbol:"601006.sh" }];
*/


var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.MINUTE_DATA_ID;
item.ArySymbol=[ { Symbol:"AU2602.shfe"}, { Symbol:"002594.sz"}, { Symbol:"HSI.hk" },{ Symbol:"01211.hk"}  ];



/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.BASE_DATA_V2_ID;
//item.ArySymbol=[{ Symbol:"601006.sh" },{ Symbol:"000858.sz"} ,{ Symbol:"300750.sz"} ];
item.ArySymbol=[{ Symbol:"600000.sh", Fields:{ ShareCapital:true} }];
*/



/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.SHARE_ID;
item.ArySymbol=[{ Symbol:"01810.hk", Count:40 }];
*/


/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.DETAIL_FULL_DATA_ID;
item.ArySymbol=[{ Symbol:"600000.sh" }];
*/

/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.DETAIL_PRICE_ID;
item.ArySymbol=[{ Symbol:"600000.sh" }];
*/


/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.BASE_DATA_ID;
item.ArySymbol=[{ Symbol:"BC2601.ine"},{Symbol:"SI2601.gzfe"}, {Symbol:"IF2603.cfe"}, {Symbol:"BB2601.dce"}, { Symbol:"AU0.shfe"}, { Symbol:"01810.hk" , Fields:{ KLine:{ Count:5 } }},{ Symbol:"HSI.hk", Fields:{ MinuteClose:true }} ,{ Symbol:"300750.sz"} ];
*/


/*
var item=new HQRequestItem()
item.Type=JSCHART_DATA_TYPE_ID.DETAIL_DATA_ID;
item.ArySymbol=[{ Symbol:"AU0.shfe" }, { Symbol:"600000.sh" }];
*/




g_HQChartDataService.RequestData(item);