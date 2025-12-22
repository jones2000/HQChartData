

class RequestProxy
{
    HeaderRules=
    {
        removeRuleIds: [1],
        addRules: 
        [
            {
                id: 1,
                priority: 1,
                condition: 
                {
                    urlFilter: 'hq.sinajs.cn/*',
                    // domains: ['pic.ibaotu.com'],
                },
                action: 
                {
                    type: "modifyHeaders",
                    requestHeaders: 
                    [
                        {
                            header: "Referer",
                            operation: "set",
                            value: "https://vip.stock.finance.sina.com.cn/"
                        },
                    ],
                }
            }
        ]
    }


    Instal()
    {
        this.InstallProxy();
        this.InstallInjectHeader();
    }


    //安装代码
    InstallProxy()
    {

    }

    //请求头注入
    InstallInjectHeader()
    {
        chrome.declarativeNetRequest.updateDynamicRules(this.HeaderRules, () => 
        {
            if (chrome.runtime.lastError) 
            {
                console.error(chrome.runtime.lastError);
            } 
            else 
            {
                chrome.declarativeNetRequest.getDynamicRules((rules) => 
                {
                    console.log("[RequestProxy::]InstallInjectHeader] rules=", rules)
                });
            }
        });
    }
}