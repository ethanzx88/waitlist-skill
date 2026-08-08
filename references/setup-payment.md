# 付款弹窗设置：Stripe Buy Button

只在要做**预售**（让人真掏钱）时才需要。只收 waitlist 邮箱的话，整节跳过，
把 `CONFIG.stripeBuyButtonId` 和 `stripePublishableKey` 留空，按钮会自动隐藏。

---

## 先说清楚一件事

前面的域名查询、页面生成、waitlist 收集三段都做到了零 credential。
**收款这段做不到，这是硬约束**：钱要进谁的账户，就得有谁的 Stripe 账号。

所以模板发给朋友时，他需要自己注册 Stripe 并填自己的两个值。你的 key 绝不要外传。

`publishable-key`（`pk_` 开头）是设计上就可以公开的，放在网页里没问题。
**`sk_` 开头的 secret key 永远不要出现在任何前端文件里。** 这套模板全程不需要 secret key。

---

## 步骤

### 1. 建 Payment Link
Stripe Dashboard → [Payment Links](https://dashboard.stripe.com/payment-links) → 新建链接，
选一个已有产品或现场建一个，设好价格。

### 2. 生成 Buy Button
创建完链接后，在链接详情里点 **Buy button** 标签。可以调：

- 简单按钮 / 卡片组件两种样式
- 品牌色、圆角、字体
- 按钮文案（比如改成「预订，立减 25%」）
- 界面语言

调好点 **Copy code**。

### 3. 从代码里抠两个值
复制出来的代码长这样：

```html
<script async src="https://js.stripe.com/v3/buy-button.js"></script>
<stripe-buy-button
  buy-button-id="buy_btn_1Abc..."
  publishable-key="pk_live_51Abc...">
</stripe-buy-button>
```

**不要整段粘进落地页**，模板会自己注入。只把两个值填进 `CONFIG`：

```js
stripeBuyButtonId: "buy_btn_1Abc...",
stripePublishableKey: "pk_live_51Abc...",
```

### 4. 效果
点击后由 Stripe 接管结账，以浮层形式打开，用户不用跳去别的站。
自动带 Apple Pay / Google Pay，3D Secure 也是 Stripe 处理，你这边零后端。

---

## 本地测试的坑

**Buy Button 需要真实域名才能渲染，直接双击打开 `index.html`（`file://`）是不显示的。**
本地必须起一个 HTTP 服务：

```bash
npx http-server . -p 8080 -o
```

然后访问 `http://localhost:8080`。

---

## 先用测试模式

Dashboard 左上角切到 **测试模式 (Test mode)**，用测试模式的 `pk_test_...` 和对应的
buy button id 跑一遍。测试卡号：

```
4242 4242 4242 4242
```

有效期填任意未来日期，CVC 任意三位。跑通了再换成 live key。

---

## 预售的几个建议

**用一次性付款，不要用订阅。** 产品还没上线就扣月费，退款和纠纷会很麻烦。
收一笔定金或首期，交付时再转订阅。

**金额别太大。** 预售的目的是测「愿不愿意掏钱」这个动作本身，不是把钱赚够。
定金 $20 到 $50 这个量级就足够把「说会用」和「真会买」分开了。

**退款条件写在按钮旁边，别藏在 FAQ 里。** 比如：

> 预订即锁定 25% 终身折扣。产品若在 X 月 X 日前未交付，全额退款，回一封邮件即可。

这不只是道德问题，也是转化问题：说清楚退款反而会提高预订率。

**参考量级**：ConvertKit 当年靠三档预售（25% 终身折扣 + 免费一个月 + 预付三个月）
拿到 19 笔预售、$972 MRR、$2,916 现金到账。19 笔就足够证明这事能做了。

---

## 部署了 CSP 的话

需要放行：

```
frame-src  https://js.stripe.com
script-src https://js.stripe.com
```

---

## 可选：Stripe 官方 agent 工具

Stripe 官方出了给 AI agent 用的 skills 和 CLI，装了之后写 Stripe 相关代码会准很多：

```bash
npm install -g @stripe/cli
```

```bash
stripe agent setup
```

也可以只接官方 MCP，让 Claude 直接读你的 Stripe 账号来核对配置：

```bash
claude mcp add --transport http stripe https://mcp.stripe.com/
```

这两个都是可选项，本 skill 不依赖它们。
