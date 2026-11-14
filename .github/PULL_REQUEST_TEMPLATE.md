## 说明

<!-- 写清这次改了什么、为什么改，以及是哪一位真人委托的。 -->

## 委托人与工具

Author-Member: 

Author-Tool: 

<!-- Author-Member 填写委托这次改动的真人称呼，不要填 Cursor、WorkBuddy、TRAE CN 或 ChatGPT Work。Author-Tool 填写实际使用的 AI IDE。两种字段各只能有一行。 -->

## 关联

<!-- 有 Issue 时写 Fixes #编号。没有 Issue 时写“无”，并说明原因。 -->

## 验证

<!-- 写明已运行的命令和结果。 -->

## 检查

- [ ] 改动在功能分支上，目标分支是 `main`
- [ ] 没有提交 `.env`、密钥、令牌或连接串
- [ ] 产品规格中的待确认项没有被写成已确认需求
- [ ] 没有替换尚未提供的 Logo，也没有加入禁止的开屏文案
- [ ] 另一位真人或所有者会用当前头部 SHA 留下审核评论

审核人不要改上面的委托人。请另发一条评论，四行各自单独成行：

```text
Review-Decision: approve
Reviewer-Member: 
Reviewer-Tool: 
Reviewed-Head: 
```

`Reviewer-Member` 填写另一位真人的称呼。仓库所有者明确要求合并时填写 `owner`。它不能与 `Author-Member` 相同。`Reviewer-Tool` 填写发出这条评论的 AI IDE。`Reviewed-Head` 填写当前 PR 头部的 40 位提交 SHA。
