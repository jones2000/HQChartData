![logo](./logo2.png)

HQChartData 获取互联网免费的行情数据Chrome插件,解决数据跨域的问题

# 交流
 前端技术交流群:719525615  
 有问题可以直接发issue.  

# 使用
1. 打开浏览器插件页面， "chrome://extensions/"  
![step1](/Tutorial/image/install_step1.png)  
2. 手动导入HQChartData插件  
![step2](/Tutorial/image/install_step2.png)  
![step3](/Tutorial/image/install_step3.png)  
3. 查看插件ID(后面使用的使用需要这个ID), 启动插件.  
![step4](/Tutorial/image/install_step4.png)  
4. 下载示例, 修改插件的id(EnvironmentVariable.js)  
![step5](/Tutorial/image/install_step5.png)  



# 使用示例代码
## 源码地址
[https://github.com/jones2000/HQChart/tree/master/webhqchart.demo/Demo_hqchart](https://github.com/jones2000/HQChart/tree/master/webhqchart.demo/Demo_hqchart) 

## 效果

![demo](/Tutorial/image/demo_1.gif)  

## 项目说明

| 文件| 说明 |
| -- | -- | 
|report_selfstock.html | 自选股列表  | 
|minute.html| 分时图 |
|kline.html| K线图 |
|deallist.html| 详细成交明细 |
|deal_price_list.html| 分价表 |
|hqchart_demo|完整示例|

# 数据来源说明
| 市场    | 分时图        | K线图        | 报价 | 买卖5档 | 成交明细 | 分价表 |
| --  | -- | -- | -- |-- | --| -- |
|上海股票 | 腾讯,东方财富  | 腾讯,东方财富 | 新浪,腾讯 | 腾讯    | 腾讯    | 腾讯   |
|深证股票 | 腾讯,东方财富  | 腾讯,东方财富 | 新浪,腾讯 | 腾讯    | 腾讯    | 腾讯   |
|港股股票 | 腾讯,东方财富  | 腾讯,东方财富 | 新浪      |        |         |       |


# 声明  
  所有的行情数据都来自互联网, 不能确保数据的正确性, 仅供开发调试使用. 任何行情数据问题都与本项目无关. 请自行去交易所购买正版行情。    
 



