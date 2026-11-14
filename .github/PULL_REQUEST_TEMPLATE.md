## 说明

<!-- 写清这次改了什么、为什么改。 -->

## Author-Bot

Author-Bot: 

<!-- 删掉本行注释，并在上一行冒号后原样填写其一：WorkBuddy、TRAE CN、ChatGPT Work、Cursor。全文只能有一行 Author-Bot。 -->

## 关联

<!-- 有 Issue 时写 Fixes #编号。没有 Issue 时写“无”，并说明原因。 -->

## 验证

<!-- 写明已运行的命令和结果。 -->

## 检查

- [ ] 改动在功能分支上，目标分支是 `main`
- [ ] 没有提交 `.env`、密钥、令牌或连接串
- [ ] 产品规格中的待确认项没有被写成已确认需求
- [ ] 没有替换尚未提供的 Logo，也没有加入禁止的开屏文案
- [ ] 另一位成员或所有者会用当前头部 SHA 留下审核评论

审核人不要改这一行。请另发一条评论，三行各自单独成行：

```text
Review-Decision: approve
Reviewer-Bot: 
Reviewed-Head: 
```

`Reviewer-Bot` 填写 `WorkBuddy`、`TRAE CN`、`ChatGPT Work`、`Cursor` 或 `owner`，并且不能与 `Author-Bot` 相同。`Reviewed-Head` 填写当前 PR 头部的 40 位提交 SHA。
