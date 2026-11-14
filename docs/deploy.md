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
