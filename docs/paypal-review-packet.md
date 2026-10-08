# PayPal 网站审核材料草稿

状态：技术接入已编写并完成模拟测试；尚未创建 PayPal REST 应用，也未进行真实 Sandbox 付款、退款或 Live 收款。因此本文是提交材料的**草稿**，不能把流程示意当成真实付款截图上传。

## 可粘贴到“其他信息”的中文说明

网站：`https://nqstrategy.com`。本站提供 MT5 EA 量化策略程序及相关内容。已登录的买家进入个人中心的积分页面，选择充值积分数量（1 积分按 1 美元计价），点击 PayPal 按钮，在 PayPal 托管页面登录并批准美元支付。本站服务器创建 PayPal 订单，并在买家批准后通过 PayPal 官方 API 扣款、核对订单号和实际付款金额；核验完成后，积分进入买家账户。买家再用积分购买 EA 策略，取得对应版本的授权和下载入口。开发者提现由本站独立审核处理。隐私政策、服务条款和风险披露可从网站页脚进入。目前正在完成 PayPal 商户应用配置与沙箱实测；正式收款入口将在商户审核、付款与退款验收后开放。

如果 PayPal 要求描述当前**已开放**的结账方式，请如实说明：PayPal 当前未上线，不能声称买家现在已经可以用 PayPal 付款。

## Buyer flow (English)

Nexus Quant (`https://nqstrategy.com`) offers MT5 EA software and related content. An authenticated buyer opens the Points page in their account, chooses a point amount (1 point priced at USD 1), and selects PayPal Checkout. The buyer approves the USD payment on PayPal's hosted interface. Our server creates and captures the PayPal order through the official REST API, verifies the completed capture and amount, and credits the points once. The buyer then redeems points for an EA strategy and receives the applicable license and download access. The integration is currently awaiting REST app credentials, sandbox payment/refund tests, and merchant approval; live PayPal checkout is not yet enabled.

## 待取得 Sandbox 应用后拍摄的真实截图

1. 网站地址栏可见 `https://nqstrategy.com`、登录后积分页面、PayPal 充值入口和美元应付金额。测试期间如页面显示 `Sandbox`，不得裁掉这个标识。
2. 点击后打开的 PayPal Sandbox 托管批准页面，显示商户、币种及付款金额。遮盖测试账户个人信息。
3. 批准后网站显示“沙箱付款已核验，未记入真实积分余额”；附 PayPal Sandbox 交易详情截图，遮盖敏感信息。Sandbox 测试订单不会增加真实积分，也不会产生可提现金额。
4. 策略详情页的积分价、积分购买后的授权和下载入口，说明付款如何对应交付。
5. 页脚与隐私政策、服务条款、风险披露页面截图。

向 PayPal 提交时只使用**实际操作得到的截图**。如审核阶段尚无 Sandbox 应用，可先提交上面的文字、公开网站页面截图，并注明支付按钮尚未开启；需要真实结账截图时，先完成 Sandbox 应用与测试。

## 商户自行配置与验收

1. 在 [PayPal Developer Apps & Credentials](https://developer.paypal.com/dashboard/applications) 选择 Sandbox，创建名称为 `Nexus Quant` 的 **Merchant REST app**，选择用于测试的 Business 商户账户；取得 Client ID 和 Secret。Merchant ID 在相应商户账户的 Account Settings → Business information 中查看；Sandbox 必须使用沙箱商户的 ID，不能填正式账户 ID。[PayPal Merchant ID 官方说明](https://www.paypal.com/us/cshelp/article/how-do-i-find-my-secure-merchant-id-on-my-paypal-account-help538)。Secret 只写入服务器私有环境文件，不提交 GitHub 或聊天。
2. 服务器 `/etc/nexus-quant/nexus.env` 填写 `PAYPAL_MODE=sandbox`、`PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_MERCHANT_ID`。先仅对测试账号开放 `POINT_RECHARGE_TEST_USER_IDS`，并在准备测试时设 `PAYPAL_RECHARGE_ENABLED=1`；`POINT_RECHARGE_ENABLED=1` 是所有充值渠道的总开关。
3. 用 Sandbox 买家账户完成小额付款；核对 PayPal capture ID、USD 金额、本站订单状态，并确认真实积分余额没有变化。模拟网络中断后验证恢复路径。Live 小额验收时，再核对真实充值积分流水和余额；重复调用捕获接口不得重复加分。
4. 在 PayPal Sandbox 完成退款测试，并核对本站的退款/积分调整处理。退款、争议、对账及异常订单的运营流程尚需完成验收，不能直接对公众开放。
5. 商户审核通过并取得 Live REST app 资料后，切换 `PAYPAL_MODE=live`，配置 Live 凭证，先在试点账号完成真实小额收款、退款和对账，再考虑取消白名单。切换模式时不得复用 Sandbox 凭证。

## 网站链接

- 首页：<https://nqstrategy.com/>
- 策略市场：<https://nqstrategy.com/?route=market>
- 隐私政策：<https://nqstrategy.com/privacy>
- 服务条款：<https://nqstrategy.com/terms>
- 风险披露：<https://nqstrategy.com/risk-disclosure>

提交前应再次点击并核对上述链接及个人中心实际入口。PayPal 可能要求商户补充业务信息或调整准入范围，最终审批由 PayPal 决定。
