"use strict";

function mt5700UpgradeError(error, fallback) {
    var message = error instanceof Error ? error.message : String(error || "");
    if (/initialization not ready|retry after initialization|transaction busy|AT queue full/i.test(message))
        return "模组正在初始化或AT通道忙，请等待恢复";
    if (/timed? ?out|timeout/i.test(message))
        return "模组响应超时，正在等待设备恢复";
    if (/fetch|network|websocket|disconnect|connection|socket|ECONN|ENOENT|serial.*closed/i.test(message))
        return "模组连接暂时中断，正在等待USB和AT通道恢复";
    if (/modem rejected AT command/i.test(message))
        return "模组未接受AT命令，请等待设备就绪后重试";
    return /[\u3400-\u9fff]/.test(message) ? message : fallback;
}

(self.webpackChunkant_design_pro = self.webpackChunkant_design_pro || []).push([ [ 210 ], {
    24861: function(Me, U, d) {
        d.r(U);
        var J = d(15009), c = d.n(J), X = d(99289), h = d.n(X), q = d(5574), v = d.n(q), x = d(59955), ee = d(78301), w = d(42119), i = d(2453), ue = d(33900), re = d(36039), ae = d(78957), y = d(77683), se = d(60801), ne = d(38703), te = d(40056), f = d(67294), a = d(85893), M = ee.Z.Text, _ = w.Z.Step, le = function() {
            var ie = (0, f.useState)(""), I = v()(ie, 2), de = I[0], ce = I[1], pe = (0, f.useState)(!1), Z = v()(pe, 2), k = Z[0], C = Z[1], Ee = (0, 
            f.useState)(0), R = v()(Ee, 2), L = R[0], S = R[1], Fe = (0, f.useState)(!1), W = v()(Fe, 2), me = W[0], K = W[1], fe = (0, 
            f.useState)(10), $ = v()(fe, 2), oe = $[0], Ae = $[1], he = (0, f.useState)(""), G = v()(he, 2), B = G[0], ve = G[1], Ce = (0, 
            f.useState)(!localStorage.getItem("mt5700-fota-recovery")), V = v()(Ce, 2), De = V[0], Q = V[1], ge = (0, f.useState)(!!localStorage.getItem("mt5700-fota-recovery")), H = v()(ge, 2), Be = H[0], be = H[1], Pe = (0,
            f.useState)(0), N = v()(Pe, 2), T = N[0], D = N[1], Xe = (0, f.useState)("等待开始升级"), Ze = v()(Xe, 2), Re = Ze[0], Je = Ze[1], Qe = (0,
            f.useState)(""), Ye = v()(Qe, 2), et = Ye[0], tt = Ye[1], rt = (0, f.useState)(0), nt = v()(rt, 2), it = nt[0], ot = nt[1], st = (0,
            f.useRef)([]), recoveryTimer = (0, f.useRef)(null), recoveryBusy = (0, f.useRef)(!1), recoveryKey = "mt5700-fota-recovery", F = x.S.getInstance(), Y = function() {
                var p = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 1;
                return K(!0), F.sendCommand("AT+CGMR").then((function(l) {
                    if (l && l.success && typeof l.data == "string") {
                        var n = l.data.match(/V\d+R\d+C\d+B\d+/i);
                        if (n) return ce(n[0]), K(!1), n[0];
                    }
                    if (p >= 10) throw new Error("连续10次无法读取有效固件版本");
                    return new Promise((function(p) {
                        return setTimeout(p, 1e3);
                    })).then((function() {
                        return Y(p + 1);
                    }));
                })).catch((function(p) {
                    throw K(!1), Je("读取版本失败"), tt(mt5700UpgradeError(p, "无法读取模组当前固件版本")), p;
                }));
            };
            (0, f.useEffect)((function() {
                var p = function() {
                    var l = h()(c()().mark((function n() {
                        var E;
                        return c()().wrap((function(e) {
                            for (;;) switch (e.prev = e.next) {
                              case 0:
                                return e.prev = 0, e.next = 3, F.connect();

                              case 3:
                                E = e.sent, E && Y(), e.next = 10;
                                break;

                              case 7:
                                e.prev = 7, e.t0 = e.catch(0), e.t0.message === "REQUIRE_AUTH_KEY" ? console.log("System/Upgrade: 等待密钥认证...") : console.error("连接失败:", e.t0);

                              case 10:
                              case "end":
                                return e.stop();
                            }
                        }), n, null, [ [ 0, 7 ] ]);
                    })));
                    return function() {
                        return l.apply(this, arguments);
                    };
                }();
                return p(), localStorage.getItem(recoveryKey) && Ue(), function() {
                    recoveryTimer.current && clearInterval(recoveryTimer.current), recoveryTimer.current = null,
                    F.disconnect();
                };
            }), []);
            (0, f.useEffect)((function() {
                if (3 !== T) return ot(0), void 0;
                var p = Date.now(), l = setInterval((function() {
                    ot(Math.floor((Date.now() - p) / 1e3));
                }), 1e3);
                return function() {
                    clearInterval(l);
                };
            }), [ T ]);
            var _e = function() {
                var p = function(p, l) {
                    if (!p || !p.success) throw new Error(l);
                    return typeof p.data == "string" ? p.data : String(p.data || "");
                }, l = function(n) {
                    return Je("正在等待USB NCM网络恢复"), tt("自动拨号已开启，正在读取网络信息（".concat(n, "/30）")), F.sendCommand("AT^HFREQINFO?").then((function(E) {
                        var s = p(E, "读取网络信息失败");
                        if (/\^HFREQINFO\s*:/i.test(s)) return !0;
                        if (n >= 30) throw new Error("USB NCM网络在60秒内未恢复");
                        return new Promise((function(p) {
                            return setTimeout(p, 2e3);
                        })).then((function() {
                            return l(n + 1);
                        }));
                    }));
                };
                return Je("正在检查USB NCM自动拨号"), tt("读取现有配置，已启用时不重置网络"), F.sendCommand("AT^SETAUTODIAL?").then((function(l) {
                    var n = p(l, "读取自动拨号配置失败");
                    var config = n.match(/^\s*\^SETAUTODIAL:\s*([01])\s*,\s*([01])\s*$/im);
                    if (!config) throw new Error("未读到有效的自动拨号配置");
                    if (config[1] === "1" && config[2] === "1") return l;
                    return Je("正在启用USB NCM自动拨号"), tt("当前未启用，配置SETAUTODIAL=1,1"), F.sendCommand("AT^SETAUTODIAL=1,1");
                })).then((function(l) {
                    return p(l, "启用USB NCM自动拨号失败"), F.sendCommand("AT^SETAUTODIAL?");
                })).then((function(l) {
                    var n = p(l, "复核自动拨号失败");
                    if (!/^\s*\^SETAUTODIAL:\s*1\s*,\s*1\s*$/im.test(n)) throw new Error("USB NCM自动拨号配置未生效");
                    return !0;
                })).then((function() {
                    return l(1);
                })).then((function() {
                    return Je("正在初始化FOTA环境"), tt("网络已就绪，正在配置模组FOTA下载模式"), F.sendCommand("AT^FOTAMODE=0,1,0,1");
                })).then((function(l) {
                    return p(l, "FOTA初始化配置失败"), !0;
                })).catch((function(p) {
                    return console.error("升级环境检查失败:", p), Je("升级环境检查失败"), tt(mt5700UpgradeError(p, "升级环境检查失败，请查看后台日志")), !1;
                }));
            }, z = function() {
                var p = h()(c()().mark((function l() {
                    var n, E;
                    return c()().wrap((function(e) {
                        for (;;) switch (e.prev = e.next) {
                          case 0:
                            return e.prev = 0, e.next = 3, F.sendCommand("AT^FOTASTATE?");

                          case 3:
                            if (n = e.sent, !(n.success && typeof n.data == "string")) {
                                e.next = 8;
                                break;
                            }
                            return E = parseInt(n.data.split(":")[1].trim()), Ae(E), e.abrupt("return", E);

                          case 8:
                            e.next = 13;
                            break;

                          case 10:
                            e.prev = 10, e.t0 = e.catch(0), console.error("查询FOTA状态失败:", e.t0);

                          case 13:
                            return e.abrupt("return", null);

                          case 14:
                          case "end":
                            return e.stop();
                        }
                    }), l, null, [ [ 0, 10 ] ]);
                })));
                return function() {
                    return p.apply(this, arguments);
                };
            }(), Ue = function() {
                if (recoveryTimer.current) return;
                var marker;
                try {
                    marker = JSON.parse(localStorage.getItem(recoveryKey) || "null");
                } catch (p) {
                    marker = null;
                }
                marker || (marker = { startedAt: Date.now(), beforeVersion: de, sawOffline: !1 });
                var save = function() {
                    localStorage.setItem(recoveryKey, JSON.stringify(marker));
                }, stop = function() {
                    recoveryTimer.current && clearInterval(recoveryTimer.current), recoveryTimer.current = null,
                    localStorage.removeItem(recoveryKey);
                }, probe = function(p) {
                    var l = new AbortController(), n = setTimeout((function() {
                        l.abort();
                    }), 8e3);
                    return fetch("/api/at", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ command: p }),
                        signal: l.signal
                    }).then((function(p) {
                        return p.json();
                    })).finally((function() {
                        clearTimeout(n);
                    }));
                }, tick = function() {
                    if (recoveryBusy.current) return;
                    if (Date.now() - marker.startedAt > 72e4) {
                        stop(), Je("模组恢复超时"), tt("未能确认升级结果");
                        return;
                    }
                    recoveryBusy.current = !0;
                    Promise.resolve().then((function() {
                        return probe("AT+CGMR").then((function(p) {
                            var l = p && p.success && String(p.data || "").match(/V\d+R\d+C\d+B\d+/i);
                            if (!l) throw new Error("AT端口暂不可用");
                            return probe("AT^FOTASTATE?").then((function(p) {
                                var n = p && p.success && /\^FOTASTATE\s*:\s*10(?:\D|$)/i.test(String(p.data || ""));
                                if (!n || (!marker.sawOffline && (!marker.beforeVersion || marker.beforeVersion === l[0]))) {
                                    Je("等待模组重启"), tt("已发送固件写入命令，正在等待USB/AT断开并重新出现");
                                    return;
                                }
                                Je("模组已恢复，正在复核拨号和网络"), tt("已重新读到固件版本 ".concat(l[0]));
                                return probe("AT^SETAUTODIAL?").then((function(p) {
                                    if (!p || !p.success || !/\^SETAUTODIAL\s*:\s*1\s*,\s*1(?:\D|$)/i.test(String(p.data || ""))) throw new Error("等待自动拨号恢复");
                                    return probe("AT^HFREQINFO?");
                                })).then((function(p) {
                                    if (!p || !p.success || !/\^HFREQINFO\s*:/i.test(String(p.data || ""))) throw new Error("等待网络恢复");
                                    return fetch("/api/cpe/system/info", { cache: "no-store" }).then((function(p) {
                                        return p.json();
                                    }));
                                })).then((function(p) {
                                    if (!p || !p.serial_ready || !p.cellular_ready) throw new Error("等待模组网卡取得地址");
                                    stop(), ce(l[0]), D(4), C(!1);
                                    if (marker.beforeVersion && marker.beforeVersion !== l[0]) {
                                        Je("固件版本已更新"), tt(l[0]);
                                    } else {
                                        Je("模组已恢复，版本变更未确认"), tt(l[0]);
                                    }
                                }));
                            }));
                        })).catch((function(p) {
                            var l = mt5700UpgradeError(p, "正在等待模组恢复");
                            if (Date.now() - marker.startedAt > 72e4) {
                                stop(), Je("模组恢复超时"), tt("12分钟内未完成写入和网络复核：".concat(l, "；请检查模组及路由器日志，不要重复触发升级"));
                                return;
                            }
                            if (!marker.sawOffline && /AT端口暂不可用/.test(l)) marker.sawOffline = !0, save();
                            Je(/等待自动拨号|等待网络|等待模组网卡/.test(l) ? "模组已上线，等待网络恢复" : marker.sawOffline ? "模组升级中，等待USB/AT恢复" : "等待模组重启"), tt(l);
                        }));
                    })).finally((function() {
                        recoveryBusy.current = !1;
                    }));
                };
                save(), D(3), S(100), C(!1), Je("模组正在写入固件并重启"), tt("蜂窝网络和AT端口暂时离线属于正常现象；管理页面会持续等待并自动复核"),
                tick(), recoveryTimer.current = setInterval(tick, 5e3);
            }, Te = function() {
                var p = h()(c()().mark((function l() {
                    var n, E, s, P, O, q;
                    return c()().wrap((function(r) {
                        for (;;) switch (r.prev = r.next) {
                          case 0:
                            if (B) {
                                r.next = 3;
                                break;
                            }
                            return Je("无法开始升级"), tt("请设置FOTA服务器地址"), r.abrupt("return");

                          case 3:
                            if (B.startsWith("http://")) {
                                r.next = 6;
                                break;
                            }
                            return Je("无法开始升级"), tt("请使用http协议的FOTA服务器地址"), r.abrupt("return");

                          case 6:
                            return n = B.endsWith("/") ? B : "".concat(B, "/"), r.prev = 7, C(!0), S(0), D(1), Je("正在初始化升级环境"), tt("正在检查USB NCM网络和自动拨号状态"),
                            r.next = 13, F.sendCommand("ATE0");

                          case 13:
                            return E = r.sent, r.next = 15, (E && E.success ? _e() : Promise.reject(new Error("AT通道初始化失败"))).then((function(p) {
                                if (!p) throw new Error("当前网络状态不满足升级条件");
                                return !0;
                            }));

                          case 15:
                            return D(2), Je("正在连接升级服务器"), tt(n), r.next = 18, F.sendCommand('AT^FOTAOEMDL="'.concat(n, '"'));

                          case 18:
                            if (E = r.sent, E.success) {
                                r.next = 24;
                                break;
                            }
                            return Je("设置升级服务器失败"), tt("模组未接受FOTA服务器地址"), C(!1), D(0), r.abrupt("return");

                          case 24:
                            P = 0, O = 0, q = !1, s = setInterval(h()(c()().mark((function m() {
                                var o, g, A, b, j, t, stopReconnectNotice;
                                return c()().wrap((function(u) {
                                    for (;;) switch (u.prev = u.next) {
                                      case 0:
                                        if (!q) {
                                            u.next = 1;
                                            break;
                                        }
                                        return u.abrupt("return");

                                      case 1:
                                        if (q = !0, P += 1, !(P > 900)) {
                                            u.next = 2;
                                            break;
                                        }
                                        return clearInterval(s), Je("固件升级超时"), tt("请检查网络后重试"), C(!1), D(0), u.abrupt("return");

                                      case 2:
                                        return u.next = 4, z();

                                      case 4:
                                        if (o = u.sent, null !== o) {
                                            O = 0;
                                        } else if (O += 1, O >= 5) return clearInterval(s), Je("查询升级状态失败"), tt("连续5次无法读取模组FOTA状态"), C(!1), D(0), u.abrupt("return");
                                        u.t0 = o, u.next = u.t0 === 10 ? 6 : u.t0 === 11 ? 8 : u.t0 === 12 ? 10 : u.t0 === 13 ? 12 : u.t0 === 14 ? 17 : u.t0 === 20 ? 22 : u.t0 === 30 ? 27 : u.t0 === 31 ? 38 : u.t0 === 40 ? 42 : u.t0 === 50 ? 50 : 52;
                                        break;

                                      case 6:
                                        return Je("等待服务器开始下载"), tt("已提交升级地址，正在等待模组FOTA响应"), u.abrupt("break", 54);

                                      case 8:
                                        return Je("正在查询新版本"), tt("模组正在向升级服务器检查可用固件"), u.abrupt("break", 54);

                                      case 10:
                                        return Je("已发现新版本"), tt("正在准备固件下载"), u.abrupt("break", 54);

                                      case 12:
                                        return clearInterval(s), Je("查询新版本失败"), tt("请检查模组网络连接"), C(!1), D(0), u.abrupt("break", 54);

                                      case 17:
                                        return clearInterval(s), Je("服务器没有可用的新版本"), tt("当前固件无需升级"), C(!1), D(0), u.abrupt("break", 54);

                                      case 22:
                                        return clearInterval(s), Je("固件下载失败"), tt("请检查网络和模组存储状态"), C(!1), D(0), u.abrupt("break", 54);

                                      case 27:
                                        return u.prev = 27, u.next = 30, F.sendCommand("AT^FOTADLQ");

                                      case 30:
                                        g = u.sent, g.success && typeof g.data == "string" && (A = g.data.replace(/\r|\n/g, "").split(",").map((function(O) {
                                            return O.replace(/[^0-9]/g, "");
                                        })).filter((function(O) {
                                            return O.length > 0;
                                        })).map((function(O) {
                                            return parseInt(O, 10);
                                        })), A.length >= 2 && (b = A[A.length - 2], j = A[A.length - 1], j > 0 && b >= 0 && (t = Math.max(0, Math.min(100, Math.floor(b / j * 100))), 
                                        S(t), Je("正在下载固件"), tt("已下载 ".concat(b, " / ").concat(j, " 字节"))))), u.next = 37;
                                        break;

                                      case 34:
                                        u.prev = 34, u.t1 = u.catch(27), console.error("查询下载进度失败:", u.t1);

                                      case 37:
                                        return u.abrupt("break", 54);

                                      case 38:
                                        return Je("下载暂时挂起"), tt("正在自动续传，请保持网络连接"), u.next = 41, F.sendCommand("AT^FOTADL=1");

                                      case 41:
                                        return u.abrupt("break", 54);

                                      case 42:
                                        return clearInterval(s), D(3), Je("固件下载完成，正在启动升级"), tt("即将执行AT^FWUP，随后模组USB和AT端口会暂时离线"),
                                        localStorage.setItem(recoveryKey, JSON.stringify({ startedAt: Date.now(), beforeVersion: de, sawOffline: false })), u.next = 47, F.sendCommand("AT^FWUP").catch((function(g) {
                                            return { success: false, error: mt5700UpgradeError(g, "连接中断") };
                                        }));

                                      case 47:
                                        g = u.sent;
                                        if (g && !g.success && /(?:\+CM[ES] ERROR|\bERROR\b|\bBUSY\b|modem rejected|模组拒绝)/i.test(String(g.error || g.data || ""))) {
                                            return localStorage.removeItem(recoveryKey), D(0), C(!1), Je("模组拒绝升级"), tt(String(g.error || g.data)), u.abrupt("break", 54);
                                        }
                                        return Ue(), C(!1), u.abrupt("break", 54);

                                      case 50:
                                        return clearInterval(s), D(3), Je("模组正在准备升级并重启"), tt("连接中断属于正常现象，正在等待USB设备和AT端口恢复"), Ue(), C(!1), u.abrupt("break", 54);

                                      case 52:
                                        return 1 === o ? u.abrupt("break", 54) : (Je("正在处理升级任务"), tt("模组正在等待进入下一阶段"), u.abrupt("break", 54));

                                      case 54:
                                        q = !1;

                                      case 55:
                                      case "end":
                                        return u.stop();
                                    }
                                }), m, null, [ [ 27, 34 ] ]);
                            }))), 1e3), r.next = 34;
                            break;

                          case 27:
                            r.prev = 27, r.t0 = r.catch(7), console.error("升级失败:", r.t0), Je("固件升级失败"), tt(mt5700UpgradeError(r.t0, "升级失败，请查看后台日志")), C(!1), S(0), D(0);

                          case 34:
                          case "end":
                            return r.stop();
                        }
                    }), l, null, [ [ 7, 27 ] ]);
                })));
                return function() {
                    return p.apply(this, arguments);
                };
            }(), lt = function() {
                st.current.forEach((function(p) {
                    return clearTimeout(p);
                })), st.current = [], C(!0), S(0), D(0), Je("演示：检查升级参数"), tt("仅演示前端流程，不会向模组发送任何AT命令");
                var p = function(p, l) {
                    st.current.push(setTimeout(l, p));
                };
                p(1200, (function() {
                    D(1), Je("演示：初始化USB NCM升级环境"), tt("使用设备默认USB+NCM模式，关闭拨号后重新启用USB自动拨号，并确认网络信息");
                })), p(3000, (function() {
                    D(2), Je("演示：已连接升级服务器"), tt("已提交FOTA地址，正在查询服务器上的新版本"), S(3);
                })), p(4300, (function() {
                    Je("演示：正在下载固件"), tt("已下载 18 / 100 MB"), S(18);
                })), p(5500, (function() {
                    tt("已下载 47 / 100 MB"), S(47);
                })), p(6700, (function() {
                    tt("已下载 78 / 100 MB"), S(78);
                })), p(7900, (function() {
                    Je("演示：固件下载完成"), tt("下载数据已校验，准备执行模组固件写入"), S(100);
                })), p(9200, (function() {
                    D(3), Je("演示：模组正在写入固件并重启"), tt("USB和AT端口暂时离线；页面持续等待设备恢复，不会反复发起三次升级"), C(!1);
                })), p(10800, (function() {
                    Je("演示：正在等待模组重新上线"), tt("第 1 次重连检查：USB设备尚未恢复");
                })), p(12400, (function() {
                    Je("演示：模组已重新连接"), tt("AT端口恢复，正在复核自动拨号、网络状态和固件版本");
                })), p(14000, (function() {
                    D(4), Je("演示：升级完成并通过复核"), tt("已重新读取AT+CGMR并同步当前版本；演示模式未改变真实固件"), C(!1);
                }));
            }, Oe = function() {
                be(!0), Q(!1);
            };
            return Be ? (0, a.jsx)(re.Z, {
                title: "系统升级",
                className: "firmware-upgrade-page",
                children: (0, a.jsxs)(ae.Z, {
                    direction: "vertical",
                    size: "large",
                    style: {
                        width: "100%"
                    },
                    children: [ (0, a.jsxs)("div", {
                        children: [ (0, a.jsx)(M, {
                            strong: !0,
                            children: "当前版本："
                        }), (0, a.jsx)(M, {
                            children: de || "未知"
                        }), (0, a.jsx)(y.ZP, {
                            style: {
                                marginLeft: 16
                            },
                            onClick: Y,
                            loading: me,
                            children: "刷新"
                        }) ]
                    }), (0, a.jsxs)(w.Z, {
                        current: T,
                        direction: window.innerWidth <= 900 ? "vertical" : "horizontal",
                        children: [ (0, a.jsx)(_, {
                            title: "准备",
                            description: "设置升级参数"
                        }), (0, a.jsx)(_, {
                            title: "初始化",
                            description: "初始化FOTA环境"
                        }), (0, a.jsx)(_, {
                            title: "下载",
                            description: "下载固件文件"
                        }), (0, a.jsx)(_, {
                            title: "升级",
                            description: "执行固件升级"
                        }), (0, a.jsx)(_, {
                            title: "完成",
                            description: "升级完成"
                        }) ]
                    }), (0, a.jsx)(te.Z, {
                        style: {
                            marginBottom: 16
                        },
                        showIcon: !0,
                        type: 4 === T ? "success" : 3 === T ? "warning" : "info",
                        message: "步骤 ".concat(T + 1, "：").concat([ "准备升级", "初始化升级环境", "下载固件", "执行升级", "升级完成" ][T]),
                        description: (0, a.jsxs)("div", {
                            children: [ (0, a.jsx)("div", {
                                style: {
                                    fontWeight: 500
                                },
                                children: Re
                            }), et && (0, a.jsx)("div", {
                                style: {
                                    marginTop: 4,
                                    wordBreak: "break-word"
                                },
                                children: et
                            }), 3 === T && (0, a.jsxs)("div", {
                                style: {
                                    marginTop: 4
                                },
                                children: [ "已等待：", it, " 秒" ]
                            }) ]
                        })
                    }), T === 0 && (0, a.jsxs)("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 12
                        },
                        children: [ (0, a.jsx)(M, {
                            strong: !0,
                            children: "FOTA服务器地址："
                        }), (0, a.jsx)(se.Z, {
                            value: B,
                            onChange: function(l) {
                                return ve(l.target.value);
                            },
                            placeholder: "请输入FOTA服务器地址",
                            style: {
                                width: "min(100%, 560px)"
                            }
                        }), (0, a.jsx)(M, {
                            type: "secondary",
                            children: "仅支持http协议"
                        }) ]
                    }), T === 0 && (0, a.jsxs)(ae.Z, {
                        direction: "horizontal",
                        wrap: !0,
                        children: [ (0, a.jsx)(y.ZP, {
                            type: "primary",
                            onClick: Te,
                            loading: k,
                            disabled: k,
                            children: "开始升级"
                        }), (0, a.jsx)(y.ZP, {
                            onClick: lt,
                            disabled: k,
                            children: "演示全过程"
                        }) ]
                    }), (T === 2 || T === 3) && (0, a.jsx)("div", {
                        style: {
                            marginTop: 16
                        },
                        children: (0, a.jsx)(ne.Z, {
                            percent: L,
                            status: L === 100 ? "success" : "active",
                            format: function(l) {
                                return "".concat(l, "% ").concat(oe === 50 ? "(正在升级...)" : "");
                            }
                        })
                    }) ]
                })
            }) : (0, a.jsx)(ue.Z, {
                title: "免责声明",
                open: De,
                onOk: Oe,
                onCancel: function() {
                    return Q(!1);
                },
                okText: "同意并继续",
                cancelText: "不同意",
                width: 600,
                centered: !0,
                children: (0, a.jsxs)("div", {
                    style: {
                        maxHeight: "400px",
                        overflowY: "auto"
                    },
                    children: [ (0, a.jsx)("h3", {
                        children: "固件升级免责声明"
                    }), (0, a.jsx)("p", {
                        children: "在进行固件升级之前，请仔细阅读以下内容："
                    }), (0, a.jsxs)("ol", {
                        children: [ (0, a.jsx)("li", {
                            children: "固件升级过程中请确保设备供电稳定，切勿断电。"
                        }), (0, a.jsx)("li", {
                            children: "升级过程中请勿进行其他操作，以免影响升级进程。"
                        }), (0, a.jsx)("li", {
                            children: "升级完成后设备将自动重启，请耐心等待。"
                        }), (0, a.jsx)("li", {
                            children: "如因操作不当导致升级失败，可能造成设备无法正常使用。"
                        }), (0, a.jsx)("li", {
                            children: "升级前请确保已备份重要数据。"
                        }), (0, a.jsx)("li", {
                            children: "升级过程中如遇异常，请及时联系技术支持。"
                        }) ]
                    }), (0, a.jsx)("p", {
                        children: '点击"同意并继续"即表示您已阅读并同意以上内容，并愿意承担升级过程中可能产生的风险。'
                    }) ]
                })
            });
        };
        U.default = le;
    }
} ]);
