# 部署

正式网站的部署和运行使用下面这一台服务器。GitHub Actions 只负责 CI。

| 项 | 值 |
| --- | --- |
| 主机 | `103.236.72.119` |
| SSH 端口 | `29244` |
| 系统 | Ubuntu 22.04 |
| 登录用户 | `root` |
| 域名 | `https://ai-box.yogdunana.cn` |
| 当前站点目录 | `/var/www/ai-box` |
| Nginx 配置 | `/etc/nginx/sites-available/ai-box.conf` |
| 证书 | Let's Encrypt，由 `certbot.timer` 自动续期 |

域名已经解析到这台主机。HTTP 会跳转到 HTTPS。证书颁给 `ai-box.yogdunana.cn`，本次有效期到 2027-02-12 22:22（Asia/Shanghai）。续期任务是 `certbot.timer`。

现在站点上是一个占位页，产品应用还没有部署。以后的上线替换这个站点目录或 Nginx 反代，仍然使用同一台机器和同一个域名。不要另找服务器，也不要把 CI 改到这台机器上。

登录凭据由所有者保管。不要把 root 密码、SSH 私钥或 `/etc/letsencrypt` 里的私钥写入仓库、Pull Request、文档或命令输出。

## 凭据放在哪里

GitHub 的 Deploy keys 只登记一把用于访问本仓库的 SSH 公钥。密码放不进去。GitHub 也不保存这把钥匙的私钥，更不能把它限定成“只有四位真人可用”。拿到私钥的人都能用。

部署私钥放在本仓库的 Actions secret，名字是 `DEPLOY_SSH_KEY`。这是加密的仓库 secret：公开页面上看不到，API 也不能把值读回来。四位真人没有各自的 GitHub 写权限，他们的 Bot 同样不能把私钥取出来。服务器登录由所有者触发的工作流在运行时使用这把钥匙。

当前的 Cloud Agent 安装令牌没有 secrets 和 deploy keys 的管理权限，写不进这项设置。所有者在本机用有 administration 权限的 `GH_TOKEN` 配置：

```bash
ssh-keygen -t ed25519 -f ai-box-deploy -N "" -C "ai-box-deploy"
# 把 ai-box-deploy.pub 追加到服务器 /root/.ssh/authorized_keys
GH_TOKEN="<administration token>" gh secret set DEPLOY_SSH_KEY < ai-box-deploy
rm -P ai-box-deploy ai-box-deploy.pub
```

root 密码留在所有者手里，作为这把钥匙失效时的备用入口。密码不写入 secret，也不贴进对话。
