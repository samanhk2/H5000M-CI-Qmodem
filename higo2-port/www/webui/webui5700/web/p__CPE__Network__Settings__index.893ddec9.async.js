"use strict";

(self.webpackChunkant_design_pro = self.webpackChunkant_design_pro || []).push([ [ 992 ], {
    16955: function(nn, Pe, _) {
        _.r(Pe);
        var br = _(97857), te = _.n(br), yr = _(9783), S = _.n(yr), _r = _(19632), ge = _.n(_r), vr = _(15009), B = _.n(vr), Br = _(99289), K = _.n(Br), Er = _(5574), C = _.n(Er), Cr = _(59955), he = _(45605), Le = _(47221), j = _(8232), v = _(2453), Fr = _(74330), ue = _(36039), O = _(78045), be = _(76560), ee = _(60801), M = _(77683), ye = _(78957), _e = _(83062), Ie = _(32983), we = _(96074), ScheduleSwitch = _(72269), A = _(67294), e = _(85893), Ne = Le.Z.Panel, xr = {
            labelCol: {
                span: 24
            },
            wrapperCol: {
                span: 24
            }
        }, ve = function(J) {
            return {
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                gap: "8px",
                marginBottom: "16px",
                alignItems: "flex-start"
            };
        }, Y = function(J) {
            return {
                flex: "1 1 0",
                width: 0,
                minWidth: 0,
                marginBottom: 0
            };
        }, jr = function() {
            var J = (0, A.useState)({
                width: window.innerWidth,
                isMobile: window.innerWidth <= 768
            }), d = C()(J, 2), Ee = d[0], Ce = d[1];
            return (0, A.useEffect)((function() {
                var F = function() {
                    Ce({
                        width: window.innerWidth,
                        isMobile: window.innerWidth <= 768
                    });
                };
                return window.addEventListener("resize", F), function() {
                    return window.removeEventListener("resize", F);
                };
            }), []), Ee;
        }, Sr = function() {
            var J = jr(), d = J.isMobile, Ee = j.Z.useForm(), Ce = C()(Ee, 1), F = Ce[0], Ze = (0, 
            A.useState)(!1), Me = C()(Ze, 2), kr = Me[0], ce = Me[1], D = Cr.S.getInstance(), Ar = (0, 
            A.useState)([]), Oe = C()(Ar, 2), Fe = Oe[0], Tr = Oe[1], Rr = (0, A.useState)(!1), ze = C()(Rr, 2), Dr = ze[0], Ke = ze[1], Pr = (0, 
            A.useState)(!1), Ue = C()(Pr, 2), We = Ue[0], un = Ue[1], Lr = (0, A.useState)(5), Ge = C()(Lr, 2), $e = Ge[0], sn = Ge[1], Ir = (0, 
            A.useState)(!1), Ve = C()(Ir, 2), xe = Ve[0], Qe = Ve[1], wr = (0, A.useState)(null), He = C()(wr, 2), R = He[0], Nr = He[1], Zr = (0, 
            A.useState)(null), Ye = C()(Zr, 2), U = Ye[0], Mr = Ye[1], Or = (0, A.useState)(!1), Je = C()(Or, 2), zr = Je[0], Xe = Je[1], Kr = (0, 
            A.useState)({}), qe = C()(Kr, 2), se = qe[0], er = qe[1], Ur = (0, A.useState)(!0), rr = C()(Ur, 2), Wr = rr[0], nr = rr[1], Gr = (0, 
            A.useState)([]), ur = C()(Gr, 2), $r = ur[0], sr = ur[1], Vr = (0, A.useState)(!1), ar = C()(Vr, 2), z = ar[0], H = ar[1];
            (0, A.useEffect)((function() {
                var u = function() {
                    var s = K()(B()().mark((function r() {
                        var a;
                        return B()().wrap((function(o) {
                            for (;;) switch (o.prev = o.next) {
                              case 0:
                                return o.prev = 0, nr(!0), o.next = 4, D.connect();

                              case 4:
                                if (a = o.sent, !a) {
                                    o.next = 10;
                                    break;
                                }
                                return o.next = 8, je();

                              case 8:
                                return o.next = 10, mr();

                              case 10:
                                return o.next = 12, pr();

                              case 12:
                                return o.next = 14, new Promise((function(s) {
                                    return setTimeout(s, 800);
                                })).then(gr);

                              case 14:
                                o.next = 19;
                                break;

                              case 16:
                                o.prev = 16, o.t0 = o.catch(0), o.t0.message === "REQUIRE_AUTH_KEY" ? console.log("Network/Settings: 等待密钥认证...") : (console.error("初始化失败:", o.t0), 
                                v.ZP.error("读取配置失败"));

                              case 19:
                                return o.prev = 19, nr(!1), o.finish(19);

                              case 22:
                              case "end":
                                return o.stop();
                            }
                        }), r, null, [ [ 0, 16, 19, 22 ] ]);
                    })));
                    return function() {
                        return s.apply(this, arguments);
                    };
                }();
                return u(), function() {
                    D.disconnect();
                };
            }), []), (0, A.useEffect)((function() {
                var u;
                return We && (u = setInterval((function() {
                    pr();
                }), $e * 1e3)), function() {
                    u && clearInterval(u);
                };
            }), [ We, $e ]);
            var readTDLockResponse = function(response) {
                if (!response?.success || !response.data) throw Error("原生 Modem 未确认锁定配置");
                const text = String(response.data);
                const result = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
                const state = result.neighborcell?.tdRadioLocks;
                if (result.verified !== true || !state?.LTE || !state?.NR) throw Error("模组未确认锁定配置");
                return state;
            }, displayTDLocks = function(state) {
                for (const kind of ["LTE", "NR"]) {
                    const key = kind.toLowerCase();
                    const {mode, mobility, rows} = state[kind];
                    const fields = {[key + "LockType"]: mode, [key + "Mobility"]: mobility};
                    const columns = mode === 3 ? ["Band"] : [
                        "Band", "Arfcn", ...(kind === "NR" ? ["ScsType"] : []), ...(mode === 2 ? ["Pci"] : [])
                    ];
                    const indexes = (rows || []).map((row, index) => {
                        columns.forEach((column, i) => {fields[key + column + "_" + index] = row[i];});
                        return index;
                    });
                    F.setFieldsValue(fields);
                    (kind === "NR" ? pe : de)(indexes);
                    sr(value => mode ? Array.from(new Set([...value, key + "Lock"])) : value.filter(item => item !== key + "Lock"));
                }
            }, je = async function() {
                ce(true);
                try {
                    displayTDLocks(readTDLockResponse(await D.sendCommand("AT+MWUITDCELLS?")));
                } catch (error) {
                    v.ZP.error(error instanceof Error ? error.message : "获取锁频设置失败");
                } finally {
                    ce(false);
                }
            }, re = function() {
                var u = K()(B()().mark((function s(r) {
                    var a, n, o, t;
                    return B()().wrap((function(p) {
                        for (;;) switch (p.prev = p.next) {
                          case 0:
                            p.prev = 0, console.log("".concat(r ? "开启" : "关闭", "飞行模式")), a = 3, n = 0, o = B()().mark((function E() {
                                var m, h, f, l, g, x;
                                return B()().wrap((function(b) {
                                    for (;;) switch (b.prev = b.next) {
                                      case 0:
                                        return b.next = 2, D.sendCommand("AT+CFUN=".concat(r ? "0" : "1"));

                                      case 2:
                                        if (m = b.sent, !m.success) {
                                            b.next = 22;
                                            break;
                                        }
                                        if (!r) {
                                            b.next = 20;
                                            break;
                                        }
                                        return h = 2e3, console.log("等待".concat(h / 1e3, "秒让飞行模式开启生效...")), b.next = 9, 
                                        new Promise((function(P) {
                                            return setTimeout(P, h);
                                        }));

                                      case 9:
                                        return b.next = 11, D.sendCommand("AT+CFUN?");

                                      case 11:
                                        if (f = b.sent, !(f.success && f.data)) {
                                            b.next = 18;
                                            break;
                                        }
                                        if (l = f.data, g = l.includes("+CFUN: 0"), g !== r) {
                                            b.next = 18;
                                            break;
                                        }
                                        return console.log("飞行模式开启成功"), b.abrupt("return", {
                                            v: !0
                                        });

                                      case 18:
                                        b.next = 22;
                                        break;

                                      case 20:
                                        return console.log("已发送关闭飞行模式命令"), b.abrupt("return", {
                                            v: !0
                                        });

                                      case 22:
                                        if (n++, !(n < a)) {
                                            b.next = 28;
                                            break;
                                        }
                                        return x = 2e3 * n, console.log("第".concat(n, "次尝试失败，").concat(x / 1e3, "秒后重试...")), 
                                        b.next = 28, new Promise((function(P) {
                                            return setTimeout(P, x);
                                        }));

                                      case 28:
                                      case "end":
                                        return b.stop();
                                    }
                                }), E);
                            }));

                          case 5:
                            if (!(n < a)) {
                                p.next = 12;
                                break;
                            }
                            return p.delegateYield(o(), "t0", 7);

                          case 7:
                            if (t = p.t0, !t) {
                                p.next = 10;
                                break;
                            }
                            return p.abrupt("return", t.v);

                          case 10:
                            p.next = 5;
                            break;

                          case 12:
                            return console.error("飞行模式".concat(r ? "开启" : "关闭", "失败，已重试").concat(a, "次")), p.abrupt("return", !1);

                          case 16:
                            return p.prev = 16, p.t1 = p.catch(0), console.error("".concat(r ? "开启" : "关闭", "飞行模式失败:"), p.t1), 
                            p.abrupt("return", !1);

                          case 20:
                          case "end":
                            return p.stop();
                        }
                    }), s, null, [ [ 0, 16 ] ]);
                })));
                return function(r) {
                    return u.apply(this, arguments);
                };
            }(), tr = [ {
                label: "关闭",
                value: 0
            }, {
                label: "锁定频点",
                value: 1
            }, {
                label: "锁定小区",
                value: 2
            }, {
                label: "锁定Band",
                value: 3
            } ], Qr = [ {
                label: "B1 2100MHz",
                value: 1
            }, {
                label: "B3 1800MHz",
                value: 3
            }, {
                label: "B5 850MHz",
                value: 5
            }, {
                label: "B8 900MHz",
                value: 8
            }, {
                label: "B34 2100MHz TDD",
                value: 34
            }, {
                label: "B38 2600MHz TDD",
                value: 38
            }, {
                label: "B39 1900MHz TDD",
                value: 39
            }, {
                label: "B40 2300MHz TDD",
                value: 40
            }, {
                label: "B41 2500MHz TDD",
                value: 41
            } ], ir = [ {
                label: "n1 2100MHz",
                value: 1
            }, {
                label: "n3 1800MHz",
                value: 3
            }, {
                label: "n5 850MHz",
                value: 5
            }, {
                label: "n8 900MHz",
                value: 8
            }, {
                label: "n28 700MHz",
                value: 28
            }, {
                label: "n41 2500MHz",
                value: 41
            }, {
                label: "n78 3500MHz",
                value: 78
            }, {
                label: "n79 4700MHz",
                value: 79
            } ], Hr = (0, A.useState)([ 0 ]), lr = C()(Hr, 2), ne = lr[0], de = lr[1], Yr = (0, 
            A.useState)([ 0 ]), or = C()(Yr, 2), W = or[0], pe = or[1], Jr = function() {
                de([].concat(ge()(ne), [ ne.length ]));
            }, cr = function() {
                var s = W.map((function(r) {
                    return F.getFieldValue("nrBand_".concat(r));
                }));
                if (W.length >= 20) {
                    v.ZP.warning("最多只能添加20个频段");
                    return;
                }
                pe([].concat(ge()(W), [ W.length ]));
            }, Xr = function(s) {
                var r = ne.filter((function(n) {
                    return n !== s;
                }));
                de(r);
                var a = F.getFieldsValue();
                delete a["lteBand_".concat(s)], delete a["lteArfcn_".concat(s)], delete a["ltePci_".concat(s)], 
                F.setFieldsValue(a);
            }, dr = function(s) {
                var r = W.filter((function(n) {
                    return n !== s;
                }));
                pe(r);
                var a = F.getFieldsValue();
                delete a["nrBand_".concat(s)], delete a["nrArfcn_".concat(s)], delete a["nrPci_".concat(s)], 
                delete a["nrScsType_".concat(s)], F.setFieldsValue(a);
            }, qr = async function(values) {
                if (z) return;
                H(true); ce(true);
                try {
                    const radios = {};
                    for (const [kind, indexes] of [["LTE", ne], ["NR", W]]) {
                        const key = kind.toLowerCase();
                        const mode = values[key + "LockType"];
                        if (mode === undefined) continue;
                        const fields = mode === 3 ? ["Band"] : [
                            "Band", "Arfcn", ...(kind === "NR" ? ["ScsType"] : []),
                            ...(mode === 2 ? ["Pci"] : [])
                        ];
                        const rows = mode === 0 ? [] : indexes.map(index => fields.map(field => {
                            const value = String(values[key + field + "_" + index] ?? "").trim();
                            if (!/^\d+$/.test(value) || Number(value) > 4294967295) throw Error("请填写所有锁定参数");
                            return Number(value);
                        }));
                        radios[kind] = {mode, mobility: mode === 0 ? 0 : (values[key + "Mobility"] || 0), rows};
                    }
                    const body = btoa(JSON.stringify({action: "configure", radios})).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
                    const response = await D.sendCommand("AT+MWUITDCELLS=" + body);
                    displayTDLocks(readTDLockResponse(response));
                    v.ZP.success("锁定配置已回读确认");
                } catch (error) {
                    v.ZP.error(error instanceof Error ? error.message : "锁定设置失败");
                } finally {
                    ce(false); H(false);
                }
            }, pr = async function() {
    if (z) return;
    H(true); Ke(true);
    try {
        const response = await D.sendCommand("AT+MWUITDCELLSSCAN?");
        if (!response.success || !response.data) throw Error("原生 Modem 邻区查询失败");
        const text = String(response.data);
        const value = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        const scan = value.neighborcell;
        if (!scan || !Array.isArray(scan.LTE) || !Array.isArray(scan.NR) || scan.scanPerformed !== true) throw Error("邻区返回格式无效");
        const rows = [];
        for (const type of ["LTE", "NR"]) for (const row of scan[type]) {
            rows.push({type, arfcn:row.arfcn, pci:row.pci, band:row.band, scs:row.scs, rsrp:row.rsrp ?? "--", rsrq:row.rsrq ?? "--", sinr:row.sinr ?? "--", rxlev:row.rssi ?? "--"});
        }
        Tr(rows);
        if (scan.unparsed && scan.unparsed.length) v.ZP.warning("部分模组返回无法解析，请在 AT 调试查看原始返回");
        else if (!rows.length) v.ZP.info("当前无邻区数据");
    } catch (error) {Tr([]); v.ZP.error("扫描邻区失败：" + String(error));}
    finally {Ke(false); H(false);}
}, Se = function(s, r) {
                if (s === "LTE") {
                    if (r >= 0 && r <= 599) return 1;
                    if (r >= 1200 && r <= 1949) return 3;
                    if (r >= 2400 && r <= 2649) return 5;
                    if (r >= 3450 && r <= 3799) return 8;
                    if (r >= 36200 && r <= 36349) return 34;
                    if (r >= 37750 && r <= 38249) return 38;
                    if (r >= 38250 && r <= 38649) return 39;
                    if (r >= 38650 && r <= 39649) return 40;
                    if (r >= 39650 && r <= 41589) return 41;
                } else {
                    if (r >= 422e3 && r <= 434e3) return 1;
                    if (r >= 361e3 && r <= 376e3) return 3;
                    if (r >= 173800 && r <= 178800) return 5;
                    if (r >= 185e3 && r <= 192e3) return 8;
                    if (r >= 151600 && r <= 159600) return 28;
                    if (r >= 499200 && r <= 537999) return 41;
                    if (r >= 62e4 && r <= 68e4) return 78;
                    if (r >= 693334 && r <= 733333) return 79;
                }
            }, fr = function() {
                return function(r) {
                    const prefix = r.type === "NR" ? "nr" : "lte";
                    if (!/^\d+$/.test(String(r.pci ?? "")) || !/^\d+$/.test(String(r.arfcn ?? ""))) {
                        v.ZP.error("该邻区未报告完整的 PCI 和频点");
                        return;
                    }
                    const indexes = F.getFieldValue(prefix + "LockType") === 2 ? (prefix === "nr" ? W : ne) : [];
                    if (indexes.length >= 20) {
                        v.ZP.error("已达到锁定小区数量上限");
                        return;
                    }
                    const index = indexes.length ? Math.max(...indexes) + 1 : 0;
                    const fields = {
                        [prefix + "LockType"]: 2,
                        [prefix + "Band_" + index]: r.band,
                        [prefix + "Arfcn_" + index]: r.arfcn,
                        [prefix + "Pci_" + index]: r.pci
                    };
                    if (prefix === "nr") {
                        const scs = [15, 30, 60, 120, 240].indexOf(Number(r.scs));
                        fields["nrScsType_" + index] = scs < 0 ? undefined : scs;
                        pe([...indexes, index]);
                    } else de([...indexes, index]);
                    F.setFieldsValue(fields);
                    sr(value => Array.from(new Set([...value, prefix + "Lock"])));
                    v.ZP.info("已填入实测 PCI 和频点，请核对锁定参数后应用");
                };
            }(), X = function(s) {
                return s >= -80 ? {
                    color: "#52c41a",
                    text: "很好"
                } : s >= -90 ? {
                    color: "#1890ff",
                    text: "良好"
                } : s >= -100 ? {
                    color: "#faad14",
                    text: "一般"
                } : {
                    color: "#f5222d",
                    text: "较差"
                };
            }, ke = function(s) {
                return s >= -10 ? {
                    color: "#52c41a",
                    text: "很好"
                } : s >= -15 ? {
                    color: "#1890ff",
                    text: "良好"
                } : s >= -20 ? {
                    color: "#faad14",
                    text: "一般"
                } : {
                    color: "#f5222d",
                    text: "较差"
                };
            }, ae = function(s) {
                return s >= 20 ? {
                    color: "#52c41a",
                    text: "很好"
                } : s >= 10 ? {
                    color: "#1890ff",
                    text: "良好"
                } : s >= 0 ? {
                    color: "#faad14",
                    text: "一般"
                } : {
                    color: "#f5222d",
                    text: "较差"
                };
            }, rn = function(s) {
                var r = [ "RSRP", "RSRQ", "SINR" ];
                return s.flatMap((function(a) {
                    return r.map((function(n) {
                        var o = 0;
                        switch (n) {
                          case "RSRP":
                            o = Ae(Number(a.rsrp), -140, -60);
                            break;

                          case "RSRQ":
                            o = Ae(Number(a.rsrq), -40, 0);
                            break;

                          case "SINR":
                            a.type === "NR" && (o = Ae(Number(a.sinr), -20, 30));
                            break;
                        }
                        return {
                            cell: "".concat(a.type === "NR" ? "5G" : "4G", " ").concat(a.type === "NR" ? "n" : "B").concat(a.band || "?", " (").concat(a.pci, ")"),
                            metric: n,
                            value: o,
                            type: a.type,
                            rawValue: n === "RSRP" ? a.rsrp : n === "RSRQ" ? a.rsrq : a.sinr
                        };
                    })).filter((function(n) {
                        return n.value > 0 || n.metric !== "SINR";
                    }));
                }));
            }, Ae = function(s, r, a) {
                return Math.max(0, Math.min(100, (s - r) / (a - r) * 100));
            }, an = {
                data: rn(Fe),
                xField: "metric",
                yField: "value",
                seriesField: "cell",
                meta: {
                    value: {
                        min: 0,
                        max: 100
                    }
                },
                xAxis: {
                    line: null,
                    tickLine: null,
                    grid: {
                        line: {
                            style: {
                                lineDash: [ 4, 4 ]
                            }
                        }
                    }
                },
                yAxis: {
                    grid: {
                        line: {
                            type: "line",
                            style: {
                                lineDash: [ 4, 4 ]
                            }
                        }
                    }
                },
                point: {
                    size: 4
                },
                area: {
                    style: {
                        fillOpacity: .3
                    }
                },
                legend: {
                    position: "bottom"
                },
                tooltip: {
                    formatter: function(s) {
                        var r = "";
                        switch (s.metric) {
                          case "RSRP":
                            r = "RSRP: ".concat(s.rawValue, "dBm (").concat(X(Number(s.rawValue)).text, ")");
                            break;

                          case "RSRQ":
                            r = "RSRQ: ".concat(s.rawValue, "dB (").concat(ke(Number(s.rawValue)).text, ")");
                            break;

                          case "SINR":
                            r = "SINR: ".concat(s.rawValue, "dB (").concat(ae(Number(s.rawValue)).text, ")");
                            break;
                        }
                        return {
                            name: s.cell,
                            value: r
                        };
                    }
                }
            }, mr = function() {
                var u = K()(B()().mark((function s() {
                    var r, a, n, o, t, c, p;
                    return B()().wrap((function(m) {
                        for (;;) switch (m.prev = m.next) {
                          case 0:
                            return m.prev = 0, m.next = 3, new Promise((function(h) {
                                return setTimeout(h, 1e3);
                            }));

                          case 3:
                            return m.next = 5, D.sendCommand("AT^C5GOPTION?");

                          case 5:
                            r = m.sent, r.success && r.data && (a = r.data.match(/\^C5GOPTION:\s*(\d+),(\d+),(\d+)/), 
                            a && (n = C()(a, 4), o = n[0], t = n[1], c = n[2], p = n[3], Nr({
                                nr_sa_support_flag: Number(t),
                                nr_dc_mode: Number(c),
                                gc_access_mode: Number(p)
                            }))), m.next = 13;
                            break;

                          case 9:
                            m.prev = 9, m.t0 = m.catch(0), console.error("查询5G接入模式失败:", m.t0), v.ZP.error("查询5G接入模式失败");

                          case 13:
                          case "end":
                            return m.stop();
                        }
                    }), s, null, [ [ 0, 9 ] ]);
                })));
                return function() {
                    return u.apply(this, arguments);
                };
            }(), Te = function() {
                var u = K()(B()().mark((function s(r) {
                    var a, n, o;
                    return B()().wrap((function(c) {
                        for (;;) switch (c.prev = c.next) {
                          case 0:
                            if (!z) {
                                c.next = 2;
                                break;
                            }
                            return c.abrupt("return");

                          case 2:
                            return c.prev = 2, H(!0), Qe(!0), c.next = 7, re(!0);

                          case 7:
                            if (a = c.sent, a) {
                                c.next = 10;
                                break;
                            }
                            throw new Error("开启飞行模式失败");

                          case 10:
                            return n = "AT^C5GOPTION=".concat(r.nr_sa_support_flag, ",").concat(r.nr_dc_mode, ",").concat(r.gc_access_mode), 
                            c.next = 13, D.sendCommand(n);

                          case 13:
                            if (o = c.sent, o.success) {
                                c.next = 16;
                                break;
                            }
                            throw new Error("设置5G接入模式失败");

                          case 16:
                            return v.ZP.success("设置成功"), c.next = 19, mr();

                          case 19:
                            c.next = 25;
                            break;

                          case 21:
                            c.prev = 21, c.t0 = c.catch(2), console.error("设置5G接入模式失败:", c.t0), v.ZP.error(c.t0 instanceof Error ? c.t0.message : "设置失败");

                          case 25:
                            return c.prev = 25, Qe(!1), H(!1), c.next = 30, re(!1);

                          case 30:
                            return c.finish(25);

                          case 31:
                          case "end":
                            return c.stop();
                        }
                    }), s, null, [ [ 2, 21, 25, 31 ] ]);
                })));
                return function(r) {
                    return u.apply(this, arguments);
                };
            }(), tn = function(s) {
                return s ? s.nr_sa_support_flag === 1 && s.nr_dc_mode === 0 && s.gc_access_mode === 1 ? "仅SA" : s.nr_sa_support_flag === 0 && s.nr_dc_mode === 1 && s.gc_access_mode === 0 ? "仅NSA" : s.nr_sa_support_flag === 1 && s.nr_dc_mode === 1 && s.gc_access_mode === 1 ? "SA+NSA" : "其他" : "未知";
            }, gr = function() {
                var u = K()(B()().mark((function s() {
                    var r, a, n, o, t, c, p, E, m, h, f, l, g, x, k, b, P, L, V, q, G, ie, i, y, N, Q, $;
                    return B()().wrap((function(T) {
                        for (;;) switch (T.prev = T.next) {
                          case 0:
                            if (!z) {
                                T.next = 2;
                                break;
                            }
                            return T.abrupt("return");

                          case 2:
                            return T.prev = 2, H(!0), Xe(!0), T.next = 7, D.sendCommand("AT^NRSSBID?");

                          case 7:
                            if (r = T.sent, console.log("SSB信息响应:", r), r.success && r.data && (a = r.data.split(`\n`), 
                            n = a.find((function(fe) {
                                return fe.startsWith("^NRSSBID:");
                            })), n)) {
                                for (o = n.replace("^NRSSBID:", "").trim().split(","), t = C()(o, 6), c = t[0], 
                                p = t[1], E = t[2], m = t[3], h = t[4], f = t[5], l = [], g = 0; g < 8; g++) x = Number(o[6 + g * 2]), 
                                k = Number(o[7 + g * 2]), x !== 255 && k !== 32767 && l.push({
                                    ssbId: x,
                                    rsrp: k
                                });
                                for (b = Number(o[22]), P = [], L = 23, V = 0; V < b; V++) {
                                    for (q = o[L], G = o[L + 1], ie = Number(o[L + 2]), i = Number(o[L + 3]), y = [], 
                                    N = 0; N < 4; N++) Q = Number(o[L + 4 + N * 2]), $ = Number(o[L + 5 + N * 2]), Q !== 255 && $ !== 32767 && y.push({
                                        ssbId: Q,
                                        rsrp: $
                                    });
                                    P.push({
                                        pci: q,
                                        arfcn: G,
                                        rsrp: ie,
                                        sinr: i,
                                        ssbs: y
                                    }), L += 12;
                                }
                                Mr({
                                    servingCell: {
                                        arfcn: c,
                                        cid: p,
                                        pci: E,
                                        rsrp: Number(m),
                                        sinr: Number(h),
                                        ta: Number(f),
                                        ssbs: l
                                    },
                                    neighborCells: P
                                });
                            }
                            T.next = 16;
                            break;

                          case 12:
                            T.prev = 12, T.t0 = T.catch(2), console.error("查询SSB信息失败:", T.t0), v.ZP.error("查询SSB信息失败");

                          case 16:
                            return T.prev = 16, Xe(!1), H(!1), T.finish(16);

                          case 20:
                          case "end":
                            return T.stop();
                        }
                    }), s, null, [ [ 2, 12, 16, 20 ] ]);
                })));
                return function() {
                    return u.apply(this, arguments);
                };
            }();
            return (0, e.jsx)("div", {
                children: (0, e.jsxs)(Fr.Z, {
                    spinning: Wr,
                    wrapperClassName: "network-settings-loading",
                    tip: "正在读取配置...",
                    style: {
                        maxHeight: "100%",
                        height: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    },
                    children: [ (0, e.jsxs)(ue.Z, {
                        title: "锁频设置",
                        bodyStyle: {
                            padding: d ? "8px" : "24px"
                        },
                        children: [ (0, e.jsxs)(j.Z, te()(te()({
                            form: F,
                            onFinish: qr,
                            layout: "vertical"
                        }, xr), {}, {
                            initialValues: {
                                lteEnable: 0,
                                lteLockType: 0,
                                lteMobility: 0,
                                nrEnable: 0,
                                nrLockType: 0,
                                nrMobility: 0,
                                nrScsType: 0
                            },
                            children: [ (0, e.jsxs)(Le.Z, {
                                activeKey: $r,
                                onChange: function(s) {
                                    return sr(typeof s == "string" ? [ s ] : s);
                                },
                                children: [ (0, e.jsxs)(Ne, {
                                    header: (0, e.jsx)("span", {
                                        style: {
                                            fontSize: d ? "14px" : "16px"
                                        },
                                        children: "4G锁频设置"
                                    }),
                                    children: [ (0, e.jsx)(j.Z.Item, {
                                        label: "锁频类型",
                                        name: "lteLockType",
                                        children: (0, e.jsx)(O.ZP.Group, {
                                            children: tr.map((function(u) {
                                                return (0, e.jsx)(O.ZP, {
                                                    value: u.value,
                                                    children: u.label
                                                }, u.value);
                                            }))
                                        })
                                    }), (0, e.jsx)(j.Z.Item, {
                                        noStyle: !0,
                                        shouldUpdate: function(s, r) {
                                            return s.lteLockType !== r.lteLockType;
                                        },
                                        children: function(s) {
                                            var r = s.getFieldValue, a = r("lteLockType");
                                            return a !== 0 ? (0, e.jsxs)(e.Fragment, {
                                                children: [ (0, e.jsx)(j.Z.Item, {
                                                    label: "移动性设置",
                                                    name: "nrMobility",
                                                    tooltip: "控制是否允许小区重选和切换",
                                                    children: (0, e.jsxs)(O.ZP.Group, {
                                                        children: [ (0, e.jsx)(O.ZP, {
                                                            value: 0,
                                                            children: "禁止重选和切换"
                                                        }), (0, e.jsx)(O.ZP, {
                                                            value: 1,
                                                            children: "允许重选和切换"
                                                        }) ]
                                                    })
                                                }), ne.map((function(n) {
                                                    return (0, e.jsx)("div", {
                                                        style: {
                                                            position: "relative"
                                                        },
                                                        children: (0, e.jsxs)("div", {
                                                            style: ve(d),
                                                            children: [ (0, e.jsx)(j.Z.Item, {
                                                                label: "频段(Band) ".concat(n + 1),
                                                                name: "lteBand_".concat(n),
                                                                tooltip: "设置要锁定的LTE频段",
                                                                rules: [ {
                                                                    required: !0,
                                                                    message: "请选择频段"
                                                                } ],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(be.Z, {
                                                                    options: Qr,
                                                                    placeholder: "请选择频段"
                                                                })
                                                            }), (a === 1 || a === 2) && (0, e.jsx)(j.Z.Item, {
                                                                label: "频点(ARFCN) ".concat(n + 1),
                                                                name: "lteArfcn_".concat(n),
                                                                tooltip: "设置要锁定的频点",
                                                                rules: [ {
                                                                    required: !0,
                                                                    message: "请输入频点"
                                                                } ],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(ee.Z, {
                                                                    placeholder: "请输入频点值"
                                                                })
                                                            }), a === 2 && (0, e.jsx)(j.Z.Item, {
                                                                label: "小区ID(PCI) ".concat(n + 1),
                                                                name: "ltePci_".concat(n),
                                                                tooltip: "设置要锁定的小区ID",
                                                                rules: [ {
                                                                    required: !0,
                                                                    message: "请输入小区ID"
                                                                } ],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(ee.Z, {
                                                                    placeholder: "请输入小区ID (0-503)"
                                                                })
                                                            }), n > 0 && ne.length > 1 && (0, e.jsx)(M.ZP, {
                                                                type: "link",
                                                                danger: !0,
                                                                onClick: function() {
                                                                    return Xr(n);
                                                                },
                                                                style: {
                                                                    marginTop: "28px"
                                                                },
                                                                children: "删除"
                                                            }) ]
                                                        })
                                                    }, n);
                                                })), ne.length < 20 && (0, e.jsx)(M.ZP, {
                                                    type: "dashed",
                                                    onClick: Jr,
                                                    block: !0,
                                                    style: {
                                                        marginTop: "16px"
                                                    },
                                                    children: "添加LTE锁频项"
                                                }) ]
                                            }) : null;
                                        }
                                    }) ]
                                }, "lteLock"), (0, e.jsxs)(Ne, {
                                    header: (0, e.jsx)("span", {
                                        style: {
                                            fontSize: d ? "14px" : "16px"
                                        },
                                        children: "5G锁频设置"
                                    }),
                                    children: [ (0, e.jsx)(j.Z.Item, {
                                        label: "锁频类型",
                                        name: "nrLockType",
                                        children: (0, e.jsx)(O.ZP.Group, {
                                            children: tr.map((function(u) {
                                                return (0, e.jsx)(O.ZP, {
                                                    value: u.value,
                                                    children: u.label
                                                }, u.value);
                                            }))
                                        })
                                    }), (0, e.jsx)(j.Z.Item, {
                                        noStyle: !0,
                                        shouldUpdate: function(s, r) {
                                            return s.nrLockType !== r.nrLockType || Object.keys(s).some((function(a) {
                                                return a.startsWith("nrBand_");
                                            })) !== Object.keys(r).some((function(a) {
                                                return a.startsWith("nrBand_");
                                            }));
                                        },
                                        children: function(s) {
                                            var r = s.getFieldValue, a = r("nrLockType");
                                            return a !== 0 && a !== 3 ? (0, e.jsxs)(e.Fragment, {
                                                children: [ (0, e.jsx)(j.Z.Item, {
                                                    label: "移动性设置",
                                                    name: "nrMobility",
                                                    tooltip: "控制是否允许小区重选和切换",
                                                    children: (0, e.jsxs)(O.ZP.Group, {
                                                        children: [ (0, e.jsx)(O.ZP, {
                                                            value: 0,
                                                            children: "禁止重选和切换"
                                                        }), (0, e.jsx)(O.ZP, {
                                                            value: 1,
                                                            children: "允许重选和切换"
                                                        }) ]
                                                    })
                                                }), W.map((function(n) {
                                                    return (0, e.jsx)("div", {
                                                        style: {
                                                            position: "relative"
                                                        },
                                                        children: (0, e.jsxs)("div", {
                                                            style: ve(d),
                                                            children: [ (0, e.jsx)(j.Z.Item, {
                                                                label: "频段(Band) ".concat(n + 1),
                                                                name: "nrBand_".concat(n),
                                                                rules: [{required: true, message: "请选择频段"}],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(be.Z, {options: ir, placeholder: "请选择频段"})
                                                            }), (a === 1 || a === 2) && (0, e.jsxs)(e.Fragment, {
                                                                children: [ (0, e.jsx)(j.Z.Item, {
                                                                    label: "频点(ARFCN) ".concat(n + 1),
                                                                    name: "nrArfcn_".concat(n),
                                                                    tooltip: "设置要锁定的频点",
                                                                    rules: [ {
                                                                        required: !0,
                                                                        message: "请输入频点"
                                                                    } ],
                                                                    style: Y(d),
                                                                    children: (0, e.jsx)(ee.Z, {
                                                                        placeholder: "请输入频点值"
                                                                    })
                                                                }), (0, e.jsx)(j.Z.Item, {
                                                                    label: "子载波间隔(SCS) ".concat(n + 1),
                                                                    name: "nrScsType_".concat(n),
                                                                    rules: [{required: true, message: "请选择子载波间隔"}],
                                                                    style: Y(d),
                                                                    children: (0, e.jsx)(be.Z, {
                                                                        options: [15, 30, 60, 120, 240].map((khz, value) => ({value, label: khz + " kHz"})),
                                                                        placeholder: "选择 SCS"
                                                                    })
                                                                }) ]
                                                            }), a === 2 && (0, e.jsx)(j.Z.Item, {
                                                                label: "小区ID(PCI) ".concat(n + 1),
                                                                name: "nrPci_".concat(n),
                                                                tooltip: "设置要锁定的小区ID",
                                                                rules: [ {
                                                                    required: !0,
                                                                    message: "请输入小区ID"
                                                                } ],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(ee.Z, {
                                                                    placeholder: "请输入小区ID (0-1007)"
                                                                })
                                                            }), (0, e.jsx)(M.ZP, {
                                                                type: "link",
                                                                danger: n > 0,
                                                                disabled: n === 0,
                                                                onClick: function() {
                                                                    return n > 0 && dr(n);
                                                                },
                                                                style: {
                                                                    marginTop: "28px",
                                                                    minWidth: 52
                                                                },
                                                                children: "删除"
                                                            }) ]
                                                        })
                                                    }, n);
                                                })), W.length < 20 && (0, e.jsx)(M.ZP, {
                                                    type: "dashed",
                                                    onClick: cr,
                                                    block: !0,
                                                    style: {
                                                        marginTop: "16px"
                                                    },
                                                    children: "添加NR锁频项"
                                                }) ]
                                            }) : a === 3 ? (0, e.jsxs)(e.Fragment, {
                                                children: [ (0, e.jsx)(j.Z.Item, {
                                                    label: "移动性设置",
                                                    name: "nrMobility",
                                                    tooltip: "控制是否允许小区重选和切换",
                                                    children: (0, e.jsxs)(O.ZP.Group, {
                                                        children: [ (0, e.jsx)(O.ZP, {
                                                            value: 0,
                                                            children: "禁止重选和切换"
                                                        }), (0, e.jsx)(O.ZP, {
                                                            value: 1,
                                                            children: "允许重选和切换"
                                                        }) ]
                                                    })
                                                }), W.map((function(n) {
                                                    return (0, e.jsx)("div", {
                                                        style: {
                                                            position: "relative"
                                                        },
                                                        children: (0, e.jsxs)("div", {
                                                            style: ve(d),
                                                            children: [ (0, e.jsx)(j.Z.Item, {
                                                                label: "频段(Band) ".concat(n + 1),
                                                                name: "nrBand_".concat(n),
                                                                rules: [{required: true, message: "请选择频段"}],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(be.Z, {options: ir, placeholder: "请选择频段"})
                                                            }), (a === 1 || a === 2) && (0, e.jsxs)(e.Fragment, {
                                                                children: [ (0, e.jsx)(j.Z.Item, {
                                                                    label: "频点(ARFCN) ".concat(n + 1),
                                                                    name: "nrArfcn_".concat(n),
                                                                    tooltip: "设置要锁定的频点",
                                                                    rules: [ {
                                                                        required: !0,
                                                                        message: "请输入频点"
                                                                    } ],
                                                                    style: Y(d),
                                                                    children: (0, e.jsx)(ee.Z, {
                                                                        placeholder: "请输入频点值"
                                                                    })
                                                                }), (0, e.jsx)(j.Z.Item, {
                                                                    label: "子载波间隔(SCS) ".concat(n + 1),
                                                                    name: "nrScsType_".concat(n),
                                                                    rules: [{required: true, message: "请选择子载波间隔"}],
                                                                    style: Y(d),
                                                                    children: (0, e.jsx)(be.Z, {
                                                                        options: [15, 30, 60, 120, 240].map((khz, value) => ({value, label: khz + " kHz"})),
                                                                        placeholder: "选择 SCS"
                                                                    })
                                                                }) ]
                                                            }), a === 2 && (0, e.jsx)(j.Z.Item, {
                                                                label: "小区ID(PCI) ".concat(n + 1),
                                                                name: "nrPci_".concat(n),
                                                                tooltip: "设置要锁定的小区ID",
                                                                rules: [ {
                                                                    required: !0,
                                                                    message: "请输入小区ID"
                                                                } ],
                                                                style: Y(d),
                                                                children: (0, e.jsx)(ee.Z, {
                                                                    placeholder: "请输入小区ID (0-1007)"
                                                                })
                                                            }), (0, e.jsx)(M.ZP, {
                                                                type: "link",
                                                                danger: n > 0,
                                                                disabled: n === 0,
                                                                onClick: function() {
                                                                    return n > 0 && dr(n);
                                                                },
                                                                style: {
                                                                    marginTop: "28px",
                                                                    minWidth: 52
                                                                },
                                                                children: "删除"
                                                            }) ]
                                                        })
                                                    }, n);
                                                })), W.length < 20 && (0, e.jsx)(M.ZP, {
                                                    type: "dashed",
                                                    onClick: cr,
                                                    block: !0,
                                                    style: {
                                                        marginTop: "16px"
                                                    },
                                                    children: "添加NR锁频项"
                                                }) ]
                                            }) : null;
                                        }
                                    }) ]
                                }, "nrLock") ]
                            }), (0, e.jsx)(j.Z.Item, {
                                style: {
                                    marginTop: 24,
                                    marginBottom: 24,
                                    textAlign: "right",
                                    borderTop: "1px solid #f0f0f0",
                                    paddingTop: 16
                                },
                                children: (0, e.jsx)(M.ZP, {
                                    type: "primary",
                                    htmlType: "submit",
                                    loading: kr,
                                    disabled: z,
                                    children: "保存设置"
                                })
                            }) ]
                        })), (0, e.jsx)(ue.Z, {
                            style: {
                                marginTop: 24
                            },
                            bodyStyle: {
                                padding: d ? "8px" : "24px"
                            },
                            title: (0, e.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: d ? "14px" : "16px"
                                },
                                children: [ (0, e.jsxs)(ye.Z, {
                                    children: [ (0, e.jsx)("span", {
                                        children: "邻区扫描"
                                    }), (0, e.jsx)(_e.Z, {
                                        title: (0, e.jsxs)("div", {
                                            children: [ (0, e.jsx)("div", {
                                                children: "先在上方设置并锁定目标频点，再进行邻区扫描，可以更容易找到需要的小区"
                                            }), (0, e.jsxs)("div", {
                                                style: {
                                                    marginTop: "8px"
                                                },
                                                children: [ (0, e.jsx)("strong", {
                                                    children: "4G建议值："
                                                }), (0, e.jsxs)("ul", {
                                                    style: {
                                                        margin: "4px 0",
                                                        paddingLeft: "16px"
                                                    },
                                                    children: [ (0, e.jsxs)("li", {
                                                        children: [ "信号强度(RSRP) ", ">", " -100dBm" ]
                                                    }), (0, e.jsxs)("li", {
                                                        children: [ "信号质量(RSRQ) ", ">", " -15dB" ]
                                                    }) ]
                                                }) ]
                                            }), (0, e.jsxs)("div", {
                                                children: [ (0, e.jsx)("strong", {
                                                    children: "5G建议值："
                                                }), (0, e.jsxs)("ul", {
                                                    style: {
                                                        margin: "4px 0",
                                                        paddingLeft: "16px"
                                                    },
                                                    children: [ (0, e.jsxs)("li", {
                                                        children: [ "信号强度(RSRP) ", ">", " -110dBm" ]
                                                    }), (0, e.jsxs)("li", {
                                                        children: [ "信号质量(RSRQ) ", ">", " -18dB" ]
                                                    }), (0, e.jsxs)("li", {
                                                        children: [ "信噪比(SINR) ", ">", " 0dB" ]
                                                    }) ]
                                                }) ]
                                            }) ]
                                        }),
                                        children: (0, e.jsx)(he.Z, {})
                                    }) ]
                                }), (0, e.jsx)(ye.Z, {
                                    children: (0, e.jsx)(M.ZP, {
                                        type: "primary",
                                        size: d ? "middle" : "small",
                                        onClick: pr,
                                        loading: Dr,
                                        disabled: z,
                                        children: "扫描邻区"
                                    })
                                }) ]
                            }),
                            children: Fe.length > 0 ? (0, e.jsx)("div", {
                                style: {
                                    display: "grid",
                                    gridTemplateColumns: d ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: d ? "4px" : "8px"
                                },
                                children: Fe.map((function(u, s) {
                                    return (0, e.jsxs)(ue.Z, {
                                        size: d ? "small" : "default",
                                        style: {
                                            background: "var(--ant-bg-elevated)",
                                            borderRadius: d ? "4px" : "8px"
                                        },
                                        bodyStyle: {
                                            padding: d ? "6px" : "8px",
                                            fontSize: d ? "12px" : "14px"
                                        },
                                        children: [ (0, e.jsxs)("div", {
                                            style: {
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: "4px"
                                            },
                                            children: [ (0, e.jsxs)("div", {
                                                style: {
                                                    fontSize: "14px",
                                                    fontWeight: "bold",
                                                    color: u.type === "NR" ? "#1890ff" : "#52c41a"
                                                },
                                                children: [ u.type === "NR" ? "5G" : "4G", " ", u.type === "NR" ? window.modemwebuiNRBand.label(u.arfcn, u.band) : u.band ? "B".concat(u.band) : "未知" ]
                                            }), (0, e.jsx)(M.ZP, {
                                                type: "link",
                                                size: "small",
                                                onClick: function() {
                                                    return fr(u);
                                                },
                                                loading: se["".concat(u.type, "_").concat(u.pci, "_").concat(u.arfcn)],
                                                disabled: se["".concat(u.type, "_").concat(u.pci, "_").concat(u.arfcn)] || z,
                                                children: se["".concat(u.type, "_").concat(u.pci, "_").concat(u.arfcn)] ? "锁定中" : "锁定"
                                            }) ]
                                        }), (0, e.jsxs)("div", {
                                            style: {
                                                fontSize: "12px",
                                                color: "#666",
                                                marginBottom: "4px"
                                            },
                                            children: [ "PCI: ", u.pci, " | ", u.arfcn ]
                                        }), (0, e.jsxs)("div", {
                                            style: {
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "2px",
                                                fontSize: "12px"
                                            },
                                            children: [ (0, e.jsxs)("div", {
                                                style: {
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px"
                                                },
                                                children: [ (0, e.jsx)("span", {
                                                    style: {
                                                        flex: "0 0 45px"
                                                    },
                                                    children: "RSRP:"
                                                }), (0, e.jsxs)("div", {
                                                    style: {
                                                        flex: 1,
                                                        padding: "1px 4px",
                                                        borderRadius: "2px",
                                                        background: X(Number(u.rsrp)).color,
                                                        color: "#fff",
                                                        textAlign: "center"
                                                    },
                                                    children: [ u.rsrp, "dBm (", X(Number(u.rsrp)).text, ")" ]
                                                }) ]
                                            }), (0, e.jsxs)("div", {
                                                style: {
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px"
                                                },
                                                children: [ (0, e.jsx)("span", {
                                                    style: {
                                                        flex: "0 0 45px"
                                                    },
                                                    children: "RSRQ:"
                                                }), (0, e.jsxs)("div", {
                                                    style: {
                                                        flex: 1,
                                                        padding: "1px 4px",
                                                        borderRadius: "2px",
                                                        background: ke(Number(u.rsrq)).color,
                                                        color: "#fff",
                                                        textAlign: "center"
                                                    },
                                                    children: [ u.rsrq, "dB (", ke(Number(u.rsrq)).text, ")" ]
                                                }) ]
                                            }), u.type === "NR" && (0, e.jsxs)("div", {
                                                style: {
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px"
                                                },
                                                children: [ (0, e.jsx)("span", {
                                                    style: {
                                                        flex: "0 0 45px"
                                                    },
                                                    children: "SINR:"
                                                }), (0, e.jsxs)("div", {
                                                    style: {
                                                        flex: 1,
                                                        padding: "1px 4px",
                                                        borderRadius: "2px",
                                                        background: ae(Number(u.sinr)).color,
                                                        color: "#fff",
                                                        textAlign: "center"
                                                    },
                                                    children: [ u.sinr, "dB (", ae(Number(u.sinr)).text, ")" ]
                                                }) ]
                                            }) ]
                                        }) ]
                                    }, s);
                                }))
                            }) : (0, e.jsx)(Ie.Z, {
                                description: (0, e.jsx)("span", {
                                    style: {
                                        fontSize: d ? "12px" : "14px"
                                    },
                                    children: "暂无邻区数据"
                                })
                            })
                        }), (0, e.jsx)(ue.Z, {
                            title: (0, e.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: d ? "14px" : "16px"
                                },
                                children: [ (0, e.jsxs)(ye.Z, {
                                    children: [ (0, e.jsx)("span", {
                                        children: "5G SSB信息"
                                    }), (0, e.jsx)(_e.Z, {
                                        title: "显示5G小区的SSB波束信息",
                                        children: (0, e.jsx)(he.Z, {})
                                    }) ]
                                }), (0, e.jsx)(M.ZP, {
                                    type: "primary",
                                    size: d ? "middle" : "small",
                                    onClick: gr,
                                    loading: zr,
                                    disabled: z,
                                    children: "刷新SSB信息"
                                }) ]
                            }),
                            style: {
                                marginTop: 16
                            },
                            bodyStyle: {
                                padding: d ? "8px" : "24px"
                            },
                            children: U ? (0, e.jsxs)("div", {
                                children: [ (0, e.jsxs)(ue.Z, {
                                    size: d ? "small" : "default",
                                    style: {
                                        background: "var(--ant-bg-elevated)",
                                        borderRadius: d ? "4px" : "8px",
                                        marginBottom: 16,
                                        width: "100%",
                                        maxWidth: d ? "100%" : "".concat(128 * Math.min(Math.max(U.servingCell.ssbs.length, 1), 9) + 8 * (Math.min(Math.max(U.servingCell.ssbs.length, 1), 9) - 1) + 18, "px"),
                                        boxSizing: "border-box"
                                    },
                                    bodyStyle: {
                                        padding: d ? "6px" : "8px",
                                        fontSize: d ? "12px" : "14px"
                                    },
                                    children: [ (0, e.jsx)("div", {
                                        style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "4px"
                                        },
                                        children: (0, e.jsxs)("div", {
                                            style: {
                                                fontSize: "14px",
                                                fontWeight: "bold",
                                                color: "#1890ff"
                                            },
                                            children: [ "服务小区 | PCI: ", U.servingCell.pci ]
                                        })
                                    }), (0, e.jsxs)("div", {
                                        style: {
                                            fontSize: "12px",
                                            color: "#666",
                                            marginBottom: "4px"
                                        },
                                        children: [ "ARFCN: ", U.servingCell.arfcn ]
                                    }), (0, e.jsxs)("div", {
                                        style: {
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "2px",
                                            fontSize: "12px",
                                            marginBottom: "8px",
                                            width: "100%",
                                            maxWidth: d ? "100%" : "".concat(128 * Math.min(Math.max(U.servingCell.ssbs.length, 1), 9) + 8 * (Math.min(Math.max(U.servingCell.ssbs.length, 1), 9) - 1), "px")
                                        },
                                        children: [ (0, e.jsxs)("div", {
                                            style: {
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            },
                                            children: [ (0, e.jsx)("span", {
                                                style: {
                                                    flex: "0 0 45px"
                                                },
                                                children: "RSRP:"
                                            }), (0, e.jsxs)("div", {
                                                style: {
                                                    flex: 1,
                                                    padding: "1px 4px",
                                                    borderRadius: "2px",
                                                    background: X(U.servingCell.rsrp).color,
                                                    color: "#fff",
                                                    textAlign: "center"
                                                },
                                                children: [ U.servingCell.rsrp, "dBm (", X(U.servingCell.rsrp).text, ")" ]
                                            }) ]
                                        }), (0, e.jsxs)("div", {
                                            style: {
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            },
                                            children: [ (0, e.jsx)("span", {
                                                style: {
                                                    flex: "0 0 45px"
                                                },
                                                children: "SINR:"
                                            }), (0, e.jsxs)("div", {
                                                style: {
                                                    flex: 1,
                                                    padding: "1px 4px",
                                                    borderRadius: "2px",
                                                    background: ae(U.servingCell.sinr).color,
                                                    color: "#fff",
                                                    textAlign: "center"
                                                },
                                                children: [ U.servingCell.sinr, "dB (", ae(U.servingCell.sinr).text, ")" ]
                                            }) ]
                                        }) ]
                                    }), (0, e.jsx)(we.Z, {
                                        orientation: "left",
                                        plain: !0,
                                        style: {
                                            margin: "8px 0"
                                        },
                                        children: "波束信息"
                                    }), (0, e.jsx)("div", {
                                        style: {
                                            display: "grid",
                                            gridTemplateColumns: d ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, 128px)",
                                            gap: "8px",
                                            width: "100%",
                                            maxWidth: d ? "100%" : "".concat(128 * Math.min(Math.max(U.servingCell.ssbs.length, 1), 9) + 8 * (Math.min(Math.max(U.servingCell.ssbs.length, 1), 9) - 1), "px")
                                        },
                                        children: U.servingCell.ssbs.map((function(u, s) {
                                            return (0, e.jsxs)("div", {
                                                style: {
                                                    background: "var(--ant-card-bg)",
                                                    padding: "8px",
                                                    borderRadius: "4px",
                                                    textAlign: "center"
                                                },
                                                children: [ (0, e.jsxs)("div", {
                                                    style: {
                                                        marginBottom: 4
                                                    },
                                                    children: [ "SSB-", u.ssbId ]
                                                }), (0, e.jsxs)("div", {
                                                    style: {
                                                        color: X(u.rsrp).color,
                                                        fontWeight: "bold"
                                                    },
                                                    children: [ u.rsrp, "dBm" ]
                                                }) ]
                                            }, s);
                                        }))
                                    }) ]
                                }), U.neighborCells.length > 0 && (0, e.jsx)("div", {
                                    style: {
                                        display: "grid",
                                        gridTemplateColumns: d ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
                                        gap: d ? "4px" : "8px"
                                    },
                                    children: U.neighborCells.map((function(u, s) {
                                        return (0, e.jsxs)(ue.Z, {
                                            size: d ? "small" : "default",
                                            style: {
                                                background: "var(--ant-bg-elevated)",
                                                borderRadius: d ? "4px" : "8px"
                                            },
                                            bodyStyle: {
                                                padding: d ? "6px" : "8px",
                                                fontSize: d ? "12px" : "14px"
                                            },
                                            children: [ (0, e.jsxs)("div", {
                                                style: {
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    marginBottom: "4px"
                                                },
                                                children: [ (0, e.jsxs)("div", {
                                                    style: {
                                                        fontSize: "14px",
                                                        fontWeight: "bold",
                                                        color: "#1890ff"
                                                    },
                                                    children: [ "邻区 | PCI: ", u.pci, " | 频段: ", window.modemwebuiNRBand.label(u.arfcn, u.band) ]
                                                }), (0, e.jsx)(M.ZP, {
                                                    type: "link",
                                                    size: "small",
                                                    onClick: function() {
                                                        return fr({
                                                            type: "NR",
                                                            pci: u.pci,
                                                            arfcn: u.arfcn,
                                                            band: Se("NR", parseInt(u.arfcn))
                                                        }, !0);
                                                    },
                                                    loading: se["NR_".concat(u.pci, "_").concat(u.arfcn)],
                                                    disabled: se["NR_".concat(u.pci, "_").concat(u.arfcn)] || z,
                                                    children: se["NR_".concat(u.pci, "_").concat(u.arfcn)] ? "锁定中" : "锁定"
                                                }) ]
                                            }), (0, e.jsxs)("div", {
                                                style: {
                                                    fontSize: "12px",
                                                    color: "#666",
                                                    marginBottom: "4px"
                                                },
                                                children: [ (0, e.jsx)(_e.Z, {
                                                    title: "SSB(同步信号块)是5G NR系统中的重要信号,包含了同步和广播信息,用于小区搜索和初始接入。多个SSB波束可以提供更好的覆盖范围和信号质量。",
                                                    children: (0, e.jsx)(he.Z, {
                                                        style: {
                                                            marginRight: 4
                                                        }
                                                    })
                                                }), "ARFCN: ", u.arfcn ]
                                            }), (0, e.jsxs)("div", {
                                                style: {
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "2px",
                                                    fontSize: "12px",
                                                    marginBottom: "8px"
                                                },
                                                children: [ (0, e.jsxs)("div", {
                                                    style: {
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px"
                                                    },
                                                    children: [ (0, e.jsx)("span", {
                                                        style: {
                                                            flex: "0 0 45px"
                                                        },
                                                        children: "RSRP:"
                                                    }), (0, e.jsxs)("div", {
                                                        style: {
                                                            flex: 1,
                                                            padding: "1px 4px",
                                                            borderRadius: "2px",
                                                            background: X(u.rsrp).color,
                                                            color: "#fff",
                                                            textAlign: "center"
                                                        },
                                                        children: [ u.rsrp, "dBm (", X(u.rsrp).text, ")" ]
                                                    }) ]
                                                }), (0, e.jsxs)("div", {
                                                    style: {
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px"
                                                    },
                                                    children: [ (0, e.jsx)("span", {
                                                        style: {
                                                            flex: "0 0 45px"
                                                        },
                                                        children: "SINR:"
                                                    }), (0, e.jsxs)("div", {
                                                        style: {
                                                            flex: 1,
                                                            padding: "1px 4px",
                                                            borderRadius: "2px",
                                                            background: ae(u.sinr).color,
                                                            color: "#fff",
                                                            textAlign: "center"
                                                        },
                                                        children: [ u.sinr, "dB (", ae(u.sinr).text, ")" ]
                                                    }) ]
                                                }) ]
                                            }), u.ssbs.length > 0 && (0, e.jsxs)(e.Fragment, {
                                                children: [ (0, e.jsx)(we.Z, {
                                                    orientation: "left",
                                                    plain: !0,
                                                    style: {
                                                        margin: "8px 0"
                                                    },
                                                    children: "波束信息"
                                                }), (0, e.jsx)("div", {
                                                    style: {
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(2, 1fr)",
                                                        gap: "4px"
                                                    },
                                                    children: u.ssbs.map((function(r, a) {
                                                        return (0, e.jsxs)("div", {
                                                            style: {
                                                                background: "var(--ant-card-bg)",
                                                                padding: "4px",
                                                                borderRadius: "4px",
                                                                textAlign: "center"
                                                            },
                                                            children: [ (0, e.jsxs)("div", {
                                                                style: {
                                                                    marginBottom: 2
                                                                },
                                                                children: [ "SSB-", r.ssbId ]
                                                            }), (0, e.jsxs)("div", {
                                                                style: {
                                                                    color: X(r.rsrp).color,
                                                                    fontWeight: "bold"
                                                                },
                                                                children: [ r.rsrp, "dBm" ]
                                                            }) ]
                                                        }, a);
                                                    }))
                                                }) ]
                                            }) ]
                                        }, s);
                                    }))
                                }) ]
                            }) : (0, e.jsx)(Ie.Z, {
                                description: (0, e.jsx)("span", {
                                    style: {
                                        fontSize: d ? "12px" : "14px"
                                    },
                                    children: "暂无SSB信息"
                                })
                            })
                        }) ]
                    }), (0, e.jsx)(ue.Z, {
                        title: (0, e.jsx)("span", {
                            style: {
                                fontSize: d ? "14px" : "16px"
                            },
                            children: "5G接入模式设置"
                        }),
                        bodyStyle: {
                            padding: d ? "8px" : "24px"
                        },
                        style: {
                            marginTop: 16
                        },
                        children: (0, e.jsxs)("div", {
                            style: {
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "8px"
                            },
                            children: [ (0, e.jsx)(M.ZP, {
                                onClick: function() {
                                    return Te({
                                        nr_sa_support_flag: 1,
                                        nr_dc_mode: 0,
                                        gc_access_mode: 1
                                    });
                                },
                                loading: xe,
                                disabled: z,
                                type: (R == null ? void 0 : R.nr_sa_support_flag) === 1 && (R == null ? void 0 : R.nr_dc_mode) === 0 ? "primary" : "default",
                                style: {
                                    flex: 1,
                                    height: d ? "36px" : "32px",
                                    fontSize: d ? "13px" : "14px",
                                    padding: "4px 8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                },
                                children: "仅SA"
                            }), (0, e.jsx)(M.ZP, {
                                onClick: function() {
                                    return Te({
                                        nr_sa_support_flag: 0,
                                        nr_dc_mode: 1,
                                        gc_access_mode: 0
                                    });
                                },
                                loading: xe,
                                disabled: z,
                                type: (R == null ? void 0 : R.nr_sa_support_flag) === 0 && (R == null ? void 0 : R.nr_dc_mode) === 1 ? "primary" : "default",
                                style: {
                                    flex: 1,
                                    height: d ? "36px" : "32px",
                                    fontSize: d ? "13px" : "14px",
                                    padding: "4px 8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                },
                                children: "仅NSA"
                            }), (0, e.jsx)(M.ZP, {
                                onClick: function() {
                                    return Te({
                                        nr_sa_support_flag: 1,
                                        nr_dc_mode: 1,
                                        gc_access_mode: 1
                                    });
                                },
                                loading: xe,
                                disabled: z,
                                type: (R == null ? void 0 : R.nr_sa_support_flag) === 1 && (R == null ? void 0 : R.nr_dc_mode) === 1 ? "primary" : "default",
                                style: {
                                    flex: 1,
                                    height: d ? "36px" : "32px",
                                    fontSize: d ? "13px" : "14px",
                                    padding: "4px 8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                },
                                children: "SA+NSA"
                            }) ]
                        })
                    }) ]
                })
            });
        };
        Pe.default = Sr;
    }
} ]);
