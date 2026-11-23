(("undefined" != typeof globalThis ? globalThis : self)["makoChunk_ant-design-pro"] = ("undefined" != typeof globalThis ? globalThis : self)["makoChunk_ant-design-pro"] || []).push([ [ "a35ff6a2" ], {
    "027a9c2a": function(e, t, r) {
        "use strict";
        r.d(t, "__esModule", {
            value: !0
        }), r.d(t, "default", {
            enumerable: !0,
            get: function() {
                return N;
            }
        });
        var n = r("777fffbe"), i = r("11dc3ea2"), a = n._(r("1753090e")), d = n._(r("c9e87c3f")), o = n._(r("3f815d78")), s = n._(r("7c65f927")), l = n._(r("04149813")), u = n._(r("a039a623")), c = n._(r("a1ed6f48")), p = n._(r("d42516a7")), m = n._(r("a2e3e7a2")), v = r("e9813f77"), f = n._(r("6547ef88")), g = r("58555f08"), A = r("fb3f0ec0"), C = r("493d19be"), T = n._(r("eb4a458e")), h = r("c7ace3f8"), b = r("612a65fd"), S = r("fd42a6c4"), M = r("ab730ead");
        function N() {
            let {
                ip: e,
                port: t
            } = (0, g.useWebSocketConfig)(), {
                setInitialState: r
            } = (0, b.useModel)("@@initialState"), [ n, o ] = (0, v.useState)(!1), [selectedCell,setSelectedCell] = (0,v.useState)(null);
            return (0, S.useScrollReset)(), (0, v.useEffect)(() => (e && t && "open" !== f.default.getStatus() && f.default.connect(`${location.protocol === "https:" ? "wss" : "ws"}://${e}:${t}`), 
            (async () => {
                await (0, C.ensureGroupReady)(e, t);
                let n = await (0, C.safeSendAT)("ATI"), {
                    model: i
                } = (0, A.parseATISystemInfo)(n);
                r(e => ({
                    ...e,
                    dynamicTitle: i ? `${i}` : "Modem-Manager"
                }));
            })(), () => {}), [ e, t ]), (0, v.useEffect)(() => ((async () => {
                await (0, C.ensureGroupReady)(e, t);
                let r = await (0, C.getCurrentGroupAsync)(e, t);
                o((0, h.isQuectelQualcomm)(r));
            })(), () => {}), [ e, t ]), (0, i.jsxs)(a.default, {
                gutter: [ 16, 16 ],
                align: "stretch",
                children: [ (0, i.jsx)(d.default, {
                    xs: 24,
                    md: 24,
                    children: (0, i.jsx)(y, {
                        isQuectel: n, selectedCell
                    })
                }), (0, i.jsx)(d.default, {
                    xs: 24,
                    md: 24,
                    children: (0, i.jsx)(Q, {})
                }), (0, i.jsx)(d.default, {
                    xs: 24,
                    md: 24,
                    children: (0, i.jsx)(R, {onSelectCell:cell=>setSelectedCell({...cell})})
                }) ]
            });
        }
        function Q() {
    const {ip, port} = (0, g.useWebSocketConfig)();
    const [busy, setBusy] = (0, v.useState)(false);
    const [classes, setClasses] = (0, v.useState)({});
    const [selected, setSelected] = (0, v.useState)({});
    const [error, setError] = (0, v.useState)("");
    const sequence = (0, v.useRef)(0);
    const {message} = s.default.useApp();
    function decodeBands(raw) {
        const text = String(raw).trim();
        const start = text.indexOf("{"), end = text.lastIndexOf("}");
        if (start < 0 || end < start) throw Error("模组未返回频段数据");
        const value = JSON.parse(text.slice(start, end + 1));
        if (!value.lockband || typeof value.lockband !== "object" || !Object.keys(value.lockband).length) throw Error("模组频段能力为空");
        for (const [kind, item] of Object.entries(value.lockband)) {
            if (!["LTE", "NR5G-SA", "NR5G-NSA", "WCDMA"].includes(kind) || !Array.isArray(item.available_band) || !item.available_band.length || !Array.isArray(item.lock_band)) throw Error("模组频段数据格式无效");
            if (item.available_band.some(band => !/^[1-9][0-9]*$/.test(band.band_id)) || item.lock_band.some(band => !/^[1-9][0-9]*$/.test(band))) throw Error("模组频段编号无效");
        }
        return value;
    }
    function publish(value) {
        setClasses(value.lockband);
        setSelected(Object.fromEntries(Object.entries(value.lockband).map(([kind, item]) => [kind, item.lock_band.map(String)])));
    }
    async function read() {
        const ticket = ++sequence.current;
        setBusy(true); setError("");
        try {
            await (0, C.ensureGroupReady)(ip, port);
            const value = decodeBands(await (0, C.safeSendAT)("AT+MWUIBANDSETTINGS?"));
            if (ticket === sequence.current) publish(value);
        } catch (err) {
            if (ticket === sequence.current) {setClasses({}); setSelected({}); setError("频段读取失败：" + String(err));}
        } finally {if (ticket === sequence.current) setBusy(false);}
    }
    (0, v.useEffect)(() => {
        let disposed = false;
        const refresh = () => {if (!disposed) read();};
        if (f.default.getStatus && f.default.getStatus() === "open") refresh();
        else f.default.addOnOpenCallback(refresh);
        return () => {disposed = true; ++sequence.current; f.default.removeOnOpenCallback(refresh);};
    }, [ip, port]);
    async function save(restore) {
        setBusy(true); setError("");
        try {
            const changes = [];
            for (const [kind, item] of Object.entries(classes)) {
                const bands = restore ? item.available_band.map(b => String(b.band_id)) : selected[kind];
                if (!bands || !bands.length) throw Error(kind + " 至少选择一个频段");
                const equal = bands.length === item.lock_band.length && bands.every(b => item.lock_band.includes(b));
                if (equal) continue;
                if (!bands.some(b => item.available_band.some(a => String(a.band_id) === b))) throw Error(kind + " 至少选择一个当前支持频段");
                if (bands.some(b => !item.available_band.some(a => String(a.band_id) === b) && !item.lock_band.includes(b))) throw Error(kind + " 不能新增能力列表外的编号");
                changes.push({band_class: kind, lock_band: bands.join(",")});
            }
            if (!changes.length) {message.info("频段配置未变化"); return;}
            await (0, C.ensureGroupReady)(ip, port);
            const encoded = btoa(JSON.stringify({changes})).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            const value = decodeBands(await (0, C.safeSendAT)("AT+MWUIBANDSETTINGS=" + encoded));
            if (value.verified !== true) throw Error("模组未确认设置回读");
            publish(value); message.success(restore ? "已恢复全部支持频段" : "频段设置成功");
        } catch (err) {setError("频段设置失败：" + String(err));}
        finally {setBusy(false);}
    }
    return (0, i.jsxs)(l.default, {title:"锁频段配置", loading:busy, className:"my-card", children:[
        error && (0, i.jsx)("p", {role:"alert", style:{color:"var(--ant-color-error)"}, children:error}),
        ...["LTE", "NR5G-SA", "NR5G-NSA", "WCDMA"].filter(kind => classes[kind]).map(kind => {
            const item = classes[kind], current = selected[kind] || [];
            const unknown = current.filter(id => !item.available_band.some(b => String(b.band_id) === id));
            return (0, i.jsxs)("section", {style:{marginBottom:24}, children:[
                (0, i.jsx)("h3", {children:kind + " · 支持 " + item.available_band.length + " 个，配置允许 " + current.length + " 个"}),
                unknown.length > 0 && (0, i.jsx)("p", {children:"其他已配置编号：" + unknown.join(", ")}),
                (0, i.jsx)(u.default, {disabled:busy, onClick:() => setSelected({...selected,[kind]:item.available_band.map(b => String(b.band_id))}), children:"全选"}),
                (0, i.jsx)(u.default, {disabled:busy, onClick:() => setSelected({...selected,[kind]:[]}), children:"全不选"}),
                (0, i.jsx)("div", {style:{display:"flex",flexWrap:"wrap",gap:12,marginTop:12}, children:item.available_band.map(band => {
                    const id = String(band.band_id), checked = current.includes(id);
                    return (0, i.jsxs)("label", {style:{display:"inline-flex",gap:6,padding:8,border:"1px solid var(--ant-color-border)",borderRadius:6},children:[
                        (0, i.jsx)("input", {type:"checkbox",checked,disabled:busy,onChange:() => setSelected({...selected,[kind]:checked ? current.filter(b => b !== id) : [...current,id]})}),
                        band.band_name || (kind.startsWith("NR") ? "n" : "B") + id
                    ]},kind+id);
                })})
            ]},kind);
        }),
        (0, i.jsx)(u.default, {disabled:busy,onClick:read,children:"查询当前配置"}),
        (0, i.jsx)(u.default, {disabled:busy || !Object.keys(classes).length,onClick:() => save(true),children:"恢复全部支持频段"}),
        (0, i.jsx)(u.default, {type:"primary",disabled:busy || !Object.keys(classes).length,onClick:() => save(false),children:"设置配置"})
    ]});
}

        async function nativeFrequencyLock(rat, values) {
            const command = values === undefined ? "AT+MWUIFREQUENCYLOCK?" : 'AT+MWUIFREQUENCYLOCK="'+rat+'",'+values.length+(values.length?','+values.join(':'):'');
            const raw=String(await sendCellChecked(command));
            const data=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
            if(!data.current||!data.supported||!['lte','nr'].every(key=>Array.isArray(data.current[key])&&Array.isArray(data.supported[key])))throw Error("锁频点状态不完整");
            if(values!==undefined&&(data.verified!==true||JSON.stringify(data.current[rat])!==JSON.stringify(values)))throw Error("锁频点未通过实际回读");
            return data;
        }
        async function sendCellChecked(command) {
            const response=String(await (0,C.safeSendAT)(command));
            if (/(?:^|[\r\n])(?:ERROR|\+(?:CME|CMS) ERROR)(?::[^\r\n]*)?(?=[\r\n]|$)/i.test(response) || !/(?:^|[\r\n])OK\s*$/.test(response.trim())) throw Error(response.trim() || "模组未返回完成确认");
            return response;
        }
        function y({
            isQuectel: e, selectedCell
        }) {
            let {
                ip: t,
                port: r
            } = (0, g.useWebSocketConfig)(), [ n, m ] = (0, v.useState)(!1), [ b, S ] = (0, 
            v.useState)(!1), [ M, N ] = (0, v.useState)("0"), [ Q, y ] = (0, v.useState)("lte"), [ R, _ ] = (0, 
            v.useState)("pci"), [ G, x ] = (0, v.useState)(""), [ P, E ] = (0, v.useState)(""), [ D, w ] = (0, 
            v.useState)(void 0), [ I, j ] = (0, v.useState)(void 0), [ L, O ] = (0, v.useState)(""), {
                message: W, modal: rangeModal
            } = s.default.useApp();
            (0,v.useEffect)(() => {
                if (!selectedCell) return;
                N("1"); y(selectedCell.rat.toLowerCase().includes("nr") ? "nr" : "lte"); _("pci");
                x(String(selectedCell.pci)); E(String(selectedCell.earfcn));
                j(selectedCell.band); w(selectedCell.subcarrierSpacing);
                O("已填入所选邻区；请确认实际频段和子载波间隔后应用。");
                document.getElementById("modem-lock-cell-form")?.scrollIntoView({block:"start",behavior:"smooth"});
            },[selectedCell]);
            let $ = async (e = !1) => {
                S(!0);
                try {
                    await (0, C.ensureGroupReady)(t, r);
                    let e = await (0, C.getCurrentGroupAsync)(t, r), n = (0, A.getLockCellStatusCmd)(e), i = "";
                    for (let e of n) i += await sendCellChecked(e) + "\n";
                    let a = (0, A.parseLockCellStatus)(i, e);
                    const frequency = (0,h.isQuectelQualcomm)(e) ? await nativeFrequencyLock() : null;
                    const activeFrequency=frequency?Object.entries(frequency.current).filter(([,values])=>values.length):[];
                    if(!a&&activeFrequency.length){
                        const [rat,values]=activeFrequency[0];N("1");y(rat);_("earfcn");E(String(values[0]).split(":")[0]);x("");w(rat==="nr"?Number(String(values[0]).split(":")[1]):void 0);j(void 0);
                        O(activeFrequency.map(([kind,list])=>kind.toUpperCase()+" 独立锁频点："+list.join(", ")).join("；"));
                        return {mode:"1",rat,freq:String(values[0]).split(":")[0],lockType:"earfcn",frequencies:frequency.current};
                    }
                    return a ? (N(a.mode), y(a.rat), _("pci"), E(a.freq), x(a.pci), w(a.subcarrierSpacing), 
                    j(a.band), O(""), a) : (N("0"), y("lte"), _("pci"), E(""), x(""), w(void 0), 
                    j(void 0), O("未查到锁小区配置"), null);
                } catch (t) {
                    if (!e) W.error("查询失败: " + t);
                    return;
                } finally {
                    S(!1);
                }
            };
            (0, v.useEffect)(() => {
                let e = !1, t = () => {
                    e || $();
                };
                return f.default.getStatus && "open" === f.default.getStatus() ? t() : f.default.addOnOpenCallback(t), 
                () => {
                    e = !0, f.default.removeOnOpenCallback(t);
                };
            }, [ t, r ]);
            let H = async e => {
                for (let t = 0; t < 14; t++) {
                    if (t) await new Promise(e => setTimeout(e, Math.min(500 + 250 * t, 2e3)));
                    let r = await $(!0);
                    if ("unlock" === e && null === r || "lock" === e && r && "1" === String(r.mode) && r.rat === Q && String(r.freq) === String(P) && String(r.pci) === String(G) && (Q !== "nr" || Number(r.band) === Number(I) && Number(r.subcarrierSpacing) === Number(D))) return !0;
                }
                return !1;
            }, q = async () => {
                if ("0" === M) {await z();return;}
                if ("1" === M) {
                    if (R === "earfcn") {
                        if(!/^\d+$/.test(P)||Number(P)>(Q==="nr"?3279165:262143)){W.error("频点参数无效");return;}
                        if(Q==="nr"&&![15,30,60,120,240].includes(Number(D))){W.error("请选择目标频点的实际子载波间隔");return;}
                        m(true);
                        try{await (0,C.ensureGroupReady)(t,r);await nativeFrequencyLock(Q,[Q==="nr"?P+":"+D:P]);await $();W.success("独立锁频点已应用并回读确认");}
                        catch(error){W.error("锁频点设置失败："+String(error));}finally{m(false);}return;
                    }
                    if (!G || !P) {
                        W.error("请填写PCI和频点");
                        return;
                    }
                    if (!/^\d+$/.test(G) || Number(G) > (Q === "nr" ? 1007 : 503) || !/^\d+$/.test(P) || Number(P) > (Q === "nr" ? 3279165 : 262143)) {
                        W.error("PCI 或频点参数无效"); return;
                    }
                    if (Q === "nr" && (!/^[1-9]\d*$/.test(String(I ?? "")) || !D)) {
                        W.error("请填写目标 NR 频段并选择子载波间隔，不能仅凭频点推断"); return;
                    }
                }
                m(!0);
                let i;
                try {
                    await (0, C.ensureGroupReady)(t, r);
                    let n = await (0, C.getCurrentGroupAsync)(t, r);
                    if((0,h.isQuectelQualcomm)(n)&&(await nativeFrequencyLock()).current[Q]?.length)throw Error("请先解除该制式的独立锁频点，再设置锁PCI");
                    if (M === "1" && Q === "nr") {
                        const text = String(await (0,C.safeSendAT)("AT+MWUIBANDSETTINGS?"));
                        const data = JSON.parse(text.slice(text.indexOf("{"),text.lastIndexOf("}")+1));
                        const available = ["NR5G-SA","NR5G-NSA"].flatMap(kind => data.lockband?.[kind]?.available_band || []);
                        if (!available.some(band => String(band.band_id) === String(I))) throw Error("目标 NR 频段不在当前模组能力列表内");
                    }
                    for (let t of (0, A.getLockCellCmd)(n, {
                        mode: M,
                        lteOrNr: Q,
                        pci: G,
                        earfcn: "lte" === Q ? P : void 0,
                        arfcn: "nr" === Q ? P : void 0,
                        subcarrierSpacing: Number(D),
                        band: I
                    })) await sendCellChecked(t);
                } catch (e) {
                    i = e;
                }
                if (i) {W.error("设置失败: " + String(i)); m(!1); return;}
                await H("0" === M ? "unlock" : "lock") ? W.success("0" === M ? "锁小区已关闭" : "锁小区成功") : W.error("设置失败: " + (i || "未读到生效配置"));
                m(!1);
            }, z = async () => {
                m(!0);
                let n, e = "cell-unlock";
                W.loading({
                    content: "正在关闭锁小区，请等待…",
                    key: e,
                    duration: 0
                });
                try {
                    await (0, C.ensureGroupReady)(t, r);
                    let n = await (0, C.getCurrentGroupAsync)(t, r);
                    const activeCells = new Set();
                    for (const query of (0, A.getLockCellStatusCmd)(n)) {
                        const current = (0, A.parseLockCellStatus)(await sendCellChecked(query), n);
                        if (current && String(current.mode) === "1") {
                            if (!["lte", "nr"].includes(current.rat)) throw Error("模组返回了未知的锁小区制式");
                            activeCells.add(current.rat);
                        }
                    }
                    if((0,h.isQuectelQualcomm)(n)){const frequency=await nativeFrequencyLock();for(const rat of ["lte","nr"])if(frequency.current[rat].length)await nativeFrequencyLock(rat,[]);}
                    for (const rat of activeCells) {
                        for (const command of (0, A.getLockCellCmd)(n, {mode:"0", lteOrNr:rat})) await sendCellChecked(command);
                    }
                } catch (e) {
                    n = e;
                } finally {
                    let t = await H("unlock");
                    W.destroy(e);
                    t && !n ? W.success("锁小区已关闭") : W.error("关闭失败: " + (n || "配置仍然存在"));
                    m(!1);
                }
            };
            return (0, i.jsx)(l.default, {
                id: "modem-lock-cell-form",
                title: (0, i.jsxs)("span", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: [ (0, i.jsx)("span", {
                        style: {
                            lineHeight: "32px"
                        },
                        children: "锁小区配置"
                    }), (0, i.jsx)("span", {
                        style: {
                            background: "var(--ant-color-fill-tertiary)",
                            borderRadius: 4,
                            padding: "0 8px",
                            height: 24,
                            display: "inline-flex",
                            alignItems: "center",
                            marginLeft: 12,
                            fontSize: 12,
                            color: "var(--ant-color-text-secondary)",
                            fontWeight: "normal",
                            lineHeight: "32px"
                        },
                        children: "强制UE注册特定的小区（单个小区锁定）"
                    }) ]
                }),
                loading: n,
                className: "my-card",
                children: (0, i.jsxs)(o.default, {
                    layout: "vertical",
                    children: [ (0, i.jsxs)(a.default, {
                        gutter: [ 16, 16 ],
                        children: [ (0, i.jsxs)(d.default, {
                            span: 12,
                            style: {},
                            children: [ (0, i.jsx)(o.default.Item, {
                                label: "功能开关",
                                required: !0,
                                children: (0, i.jsx)(p.default, {
                                    value: M,
                                    onChange: e => N(e),
                                    options: [ {
                                        label: "打开",
                                        value: "1"
                                    }, {
                                        label: "关闭",
                                        value: "0"
                                    } ],
                                    style: {
                                        width: "100%"
                                    }
                                })
                            }), "1" === M && (0, i.jsxs)(i.Fragment, {
                                children: [ (0, i.jsx)(o.default.Item, {
                                    label: "加锁类型",
                                    required: !0,
                                    children: (0, i.jsx)(p.default, {
                                        value: R,
                                        onChange: value => {_(value); if (value === "earfcn") x("");},
                                        options: [ {
                                            label: "锁PCI",
                                            value: "pci"
                                        }, {
                                            label: "锁频点",
                                            value: "earfcn"
                                        } ],
                                        style: {
                                            width: "100%"
                                        }
                                    })
                                }), "pci" === R && (0, i.jsx)(o.default.Item, {
                                    label: Q === "nr" ? "物理小区ID (PCI) - NR: 0-1007" : "物理小区ID (PCI) - LTE: 0-503",
                                    required: !0,
                                    help: (0, i.jsx)("span", {
                                        style: {
                                            fontSize: 12,
                                            color: "var(--ant-color-text-secondary)"
                                        },
                                        children: "锁PCI模式：指定要锁定的物理小区ID"
                                    }),
                                    children: (0, i.jsx)(c.default, {
                                        value: G,
                                        onChange: e => x(e.target.value.replace(/\D/g, "")),
                                        placeholder: "输入目标PCI值"
                                    })
                                }) ]
                            }) ]
                        }), "1" === M && (0, i.jsxs)(d.default, {
                            span: 12,
                            children: [ (0, i.jsx)(o.default.Item, {
                                label: "制式 (RAT)",
                                required: !0,
                                children: (0, i.jsx)(p.default, {
                                    value: Q,
                                    onChange: e => {y(e); j(void 0); w(void 0);},
                                    options: [ {
                                        label: "LTE",
                                        value: "lte"
                                    }, {
                                        label: "NR",
                                        value: "nr"
                                    } ],
                                    style: {
                                        width: "100%"
                                    }
                                })
                            }), (0, i.jsx)(o.default.Item, {
                                label: Q === "nr" ? "频点 (NR-ARFCN)" : "频点 (EARFCN)",
                                required: !0,
                                help: (0, i.jsx)("span", {
                                    style: {
                                        fontSize: 12,
                                        color: "var(--ant-color-text-secondary)"
                                    },
                                    children: R === "earfcn" ? "独立锁定频点，不指定PCI；按模组实际能力下发并回读" : "锁PCI模式：指定频点下的目标PCI"
                                }),
                                children: (0, i.jsx)(c.default, {
                                    value: P,
                                    onChange: e => E(e.target.value.replace(/\D/g, "")),
                                    placeholder: "输入频点值",
                                    disabled: "1" !== M
                                })
                            }), "pci" === R && "nr" === Q && (0, i.jsx)(o.default.Item, {
                                label: "NR 频段", required: !0,
                                help: "填写目标小区实际频段，频点重叠时不能自动推断",
                                children: (0,i.jsx)(c.default,{value:I ?? "",onChange:event=>j(event.target.value.replace(/\D/g,"")),placeholder:"输入实际 NR 频段编号"})
                            }), e && "nr" === Q && (0, i.jsx)(o.default.Item, {
                                label: "子载波间隔",
                                required: !0,
                                children: (0, i.jsx)(p.default, {
                                    value: D,
                                    onChange: w,
                                    options: [ {
                                        label: "15kHz",
                                        value: 15
                                    }, {
                                        label: "30kHz",
                                        value: 30
                                    }, {label:"60kHz",value:60}, {label:"120kHz",value:120} ],
                                    style: {
                                        width: "100%"
                                    }
                                })
                            }) ]
                        }) ]
                    }), (0, i.jsx)(a.default, {
                        children: (0, i.jsxs)(d.default, {
                            span: 24,
                            children: [ (0, i.jsx)("div", {
                                style: {
                                    margin: "16px 0 8px 0",
                                    color: "var(--ant-color-warning)",
                                    fontSize: 14
                                },
                                children: L || (I ? `\u{5F53}\u{524D}\u{8BC6}\u{522B}\u{4E3A} ${"lte" === Q ? "4G" : "5G"} Band ${I}` : "")
                            }), (0, i.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: 16,
                                    marginTop: 8,
                                    flexWrap: "wrap"
                                },
                                children: [ (0, i.jsx)(u.default, {
                                    className: "my-btn",
                                    type: "primary",
                                    icon: (0, i.jsx)(T.default, {}),
                                    loading: n,
                                    onClick: q,
                                    disabled: "1" === M && ("pci" === R && (!G || !P) || "earfcn" === R && !P),
                                    children: "设置配置"
                                }), (0, i.jsx)(u.default, {
                                    className: "my-btn",
                                    icon: (0, i.jsx)(T.default, {}),
                                    loading: b,
                                    onClick: $,
                                    children: "查询当前配置"
                                }), (0, i.jsx)(u.default, {
                                    className: "my-btn",
                                    danger: !0,
                                    icon: (0, i.jsx)(T.default, {}),
                                    onClick: z,
                                    children: "关闭锁小区"
                                }), (0, i.jsx)(u.default, {
                                    className: "my-btn",
                                    loading: b,
                                    disabled: n || b,
                                    onClick: async () => {
                                        S(true);
                                        try {
                                            await (0, C.ensureGroupReady)(t, r);
                                            const response = String(await (0, C.safeSendAT)("AT+QNWLOCK=?"));
                                            if (!/(?:^|\n)OK\s*$/.test(response) || !response.includes("+QNWLOCK:")) throw Error(response || "模组未提供参数范围");
                                            rangeModal.info({title:"当前模组锁小区参数",width:720,content:(0,i.jsx)("pre",{style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere"},children:response})});
                                        } catch (error) {W.error("参数查询失败：" + String(error));}
                                        finally {S(false);}
                                    },
                                    children: "查询参数范围"
                                }) ]
                            }) ]
                        })
                    }) ]
                })
            });
        }
        function R({onSelectCell} = {}) {
            let {
                ip: e,
                port: t
            } = (0, g.useWebSocketConfig)(), [ r, n ] = (0, v.useState)(!1), [ a, d ] = (0, 
            v.useState)([]), [ scanError, setScanError ] = (0, v.useState)(""), {
                message: o
            } = s.default.useApp(), {
                isMobile: c
            } = (0, M.useResponsive)(), p = async () => {
                n(!0); setScanError("");
                try {
                    await (0, C.ensureGroupReady)(e, t);
                    let r = await (0, C.getCurrentGroupAsync)(e, t), n = (0, A.getNeighbourCellCmd)(r), i = "";
                    for (let e of n) i += await (0, C.safeSendAT)(e) + "\n";
                    d((0, A.parseNeighbourCell)(i, r));
                } catch (error) {
                    d([]);
                    setScanError("邻区扫描失败：" + String(error && error.message || error));
                }
                n(!1);
            };
            (0, v.useEffect)(() => {
                let e = !1, t = () => {
                    e || p();
                };
                return f.default.getStatus && "open" === f.default.getStatus() ? t() : f.default.addOnOpenCallback(t), 
                () => {
                    e = !0, f.default.removeOnOpenCallback(t);
                };
            }, [ e, t ]);
            let h = (e, t) => void 0 === e ? "var(--ant-color-fill-tertiary)" : "rsrp" === t ? e > -80 ? "var(--ant-color-success)" : e > -95 ? "var(--ant-color-primary)" : e > -110 ? "var(--ant-color-warning)" : "var(--ant-color-error)" : "rsrq" === t ? e > -10 ? "var(--ant-color-success)" : e > -15 ? "var(--ant-color-primary)" : e > -20 ? "var(--ant-color-warning)" : "var(--ant-color-error)" : "rssi" === t ? e > -60 ? "var(--ant-color-success)" : e > -70 ? "var(--ant-color-primary)" : e > -80 ? "var(--ant-color-warning)" : "var(--ant-color-error)" : "sinr" === t ? e > 20 ? "var(--ant-color-success)" : e > 10 ? "var(--ant-color-primary)" : e > 0 ? "var(--ant-color-warning)" : "var(--ant-color-error)" : "var(--ant-color-fill-tertiary)", b = (e, t) => void 0 === e ? "" : "rsrp" === t ? e > -80 ? "（优秀）" : e > -95 ? "（良好）" : e > -110 ? "（一般）" : "（较差）" : "rsrq" === t ? e > -10 ? "（优秀）" : e > -15 ? "（良好）" : e > -20 ? "（一般）" : "（较差）" : "rssi" === t ? e > -60 ? "（优秀）" : e > -70 ? "（良好）" : e > -80 ? "（一般）" : "（较差）" : "sinr" === t ? e > 20 ? "（优秀）" : e > 10 ? "（良好）" : e > 0 ? "（一般）" : "（较差）" : "";
            return (0, i.jsx)(l.default, {
                className: "my-card",
                title: (0, i.jsxs)("span", {
                    children: [ "邻区扫描 ", (0, i.jsx)(m.default, {
                        styles: {
                            body: {
                                maxWidth: 320
                            }
                        },
                        title: (0, i.jsxs)("div", {
                            style: {
                                fontSize: 14,
                                lineHeight: 1.7
                            },
                            children: [ (0, i.jsx)("div", {
                                children: "先在上方设置并锁定目标频点，再进行邻区扫描，可以更容易找到需要的小区"
                            }), (0, i.jsx)("div", {
                                style: {
                                    margin: "8px 0 0 0",
                                    fontWeight: "bold"
                                },
                                children: "4G建议值："
                            }), (0, i.jsxs)("ul", {
                                style: {
                                    margin: 0,
                                    paddingLeft: 20,
                                    listStyleType: "disc"
                                },
                                children: [ (0, i.jsx)("li", {
                                    children: "信号强度(RSRP) > -100dBm"
                                }), (0, i.jsx)("li", {
                                    children: "信号质量(RSRQ) > -15dB"
                                }) ]
                            }), (0, i.jsx)("div", {
                                style: {
                                    margin: "8px 0 0 0",
                                    fontWeight: "bold"
                                },
                                children: "5G建议值："
                            }), (0, i.jsxs)("ul", {
                                style: {
                                    margin: 0,
                                    paddingLeft: 20,
                                    listStyleType: "disc"
                                },
                                children: [ (0, i.jsx)("li", {
                                    children: "信号强度(RSRP) > -110dBm"
                                }), (0, i.jsx)("li", {
                                    children: "信号质量(RSRQ) > -18dB"
                                }), (0, i.jsx)("li", {
                                    children: "信噪比(SINR) > 0dB"
                                }) ]
                            }) ]
                        }),
                        children: (0, i.jsx)(T.default, {})
                    }) ]
                }),
                extra: (0, i.jsx)(u.default, {
                    className: "my-btn",
                    type: "primary",
                    onClick: p,
                    loading: r,
                    children: "扫描邻区"
                }),
                children: (0, i.jsxs)("div", {
                    style: {
                        display: "grid",
                        gridTemplateColumns: c ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 16,
                        width: "100%",
                        justifyContent: "start"
                    },
                    children: [ 0 === a.length && (0, i.jsxs)("div", {
                        style: {
                            gridColumn: "1 / -1",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0px 0"
                        },
                        children: [ (0, i.jsx)("img", {
                            src: "/icons/zanwuxinxi.svg",
                            alt: "暂无邻区数据",
                            style: {
                                width: 128,
                                height: 128,
                                marginBottom: 8,
                                opacity: .6
                            }
                        }), (0, i.jsx)("div", {
                            style: {
                                fontSize: 14,
                                color: "var(--ant-color-text-secondary)"
                            },
                            children: scanError || (r ? "正在扫描邻区…" : "暂无邻区数据")
                        }) ]
                    }), a.filter(e => -1 !== e.pci).map((r, n) => (0, i.jsxs)("div", {
                        style: {
                            background: "var(--ant-color-fill-tertiary)",
                            borderRadius: 6,
                            padding: "2px 10px 10px 10px",
                            boxShadow: "0 1px 4px var(--ant-color-fill-tertiary)",
                            marginBottom: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            minWidth: c ? "auto" : 240,
                            maxWidth: c ? "none" : 280,
                            width: "100%",
                            justifyContent: "center"
                        },
                        className: "my-inline-div",
                        children: [ (0, i.jsxs)("div", {
                            style: {
                                fontWeight: "bold",
                                fontSize: 14,
                                color: "var(--ant-color-primary)",
                                marginBottom: 0,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%"
                            },
                            children: [ (0, i.jsxs)("span", {
                                style: {
                                    padding: 0
                                },
                                children: [ r.rat, " ", r.rat.startsWith("N") ? window.modemwebuiNRBand.label(r.earfcn, r.band) : r.band ? `B${r.band}` : "" ]
                            }), (0, i.jsx)(u.default, {
                                className: "my-btn",
                                type: "link",
                                style: {
                                    color: "var(--ant-color-primary)",
                                    fontWeight: "bold",
                                    fontSize: 14,
                                    padding: 0
                                },
                                onClick: async () => {
                                    if (r.rat.toLowerCase().includes("nr") && (!r.band || r.subcarrierSpacing === undefined)) {
                                        if (onSelectCell) {onSelectCell(r); o.info("已填入所选邻区，请确认实际 NR 频段和子载波间隔后应用。");}
                                        else o.error("模组未返回邻区频段或子载波间隔，请在上方锁小区设置中确认实际参数后锁定。PCI: " + r.pci + "，频点: " + r.earfcn);
                                        return;
                                    }
                                    let V, k = "neighbour-cell-lock";
                                    o.loading({
                                        content: "正在锁定小区，请等待…",
                                        key: k,
                                        duration: 0
                                    });
                                    try {
                                        let i = {
                                            mode: "1",
                                            lteOrNr: r.rat.toLowerCase().includes("nr") ? "nr" : "lte",
                                            pci: r.pci,
                                            earfcn: r.rat.toLowerCase().includes("nr") ? void 0 : r.earfcn,
                                            arfcn: r.rat.toLowerCase().includes("nr") ? r.earfcn : void 0,
                                            band: r.band,
                                            subcarrierSpacing: r.subcarrierSpacing
                                        };
                                        await (0, C.ensureGroupReady)(e, t);
                                        let a = await (0, C.getCurrentGroupAsync)(e, t);
                                        for (let e of (0, A.getLockCellCmd)(a, i)) await sendCellChecked(e);
                                    } catch (t) {
                                        V = t;
                                    }
                                    if (V) {o.destroy(k); o.error("锁定失败: " + String(V)); return;}
                                    for (let attempt = 0; attempt < 14; attempt++) {
                                        if (attempt) await new Promise(e => setTimeout(e, Math.min(500 + 250 * attempt, 2e3)));
                                        try {
                                            await (0, C.ensureGroupReady)(e, t);
                                            let a = await (0, C.getCurrentGroupAsync)(e, t), s = "";
                                            for (let e of (0, A.getLockCellStatusCmd)(a)) s += await sendCellChecked(e) + "\n";
                                            let n = (0, A.parseLockCellStatus)(s, a);
                                            if (n && String(n.mode) === "1" && n.rat === (r.rat.toLowerCase().includes("nr") ? "nr" : "lte") && String(n.freq) === String(r.earfcn) && String(n.pci) === String(r.pci) && (!r.rat.toLowerCase().includes("nr") || Number(n.band) === Number(r.band) && Number(n.subcarrierSpacing) === Number(r.subcarrierSpacing))) {
                                                o.destroy(k);
                                                o.success("锁定小区成功"), setTimeout(() => window.location.reload(), 500);
                                                return;
                                            }
                                        } catch (e) {}
                                    }
                                    o.destroy(k);
                                    o.error("锁定失败: " + (V || "未读到生效配置"));
                                },
                                children: "锁定"
                            }) ]
                        }), (0, i.jsxs)("div", {
                            style: {
                                fontSize: 12,
                                marginBottom: 4,
                                width: "100%",
                                textAlign: "left"
                            },
                            children: [ "PCI: ", r.pci, " | ", r.earfcn ]
                        }), (0, i.jsxs)("div", {
                            style: {
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                alignItems: "stretch",
                                width: "100%"
                            },
                            children: [ (0, i.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: 0,
                                    width: "100%"
                                },
                                children: [ (0, i.jsx)("span", {
                                    style: {
                                        width: 32,
                                        fontSize: 12,
                                        textAlign: "left",
                                        marginRight: 8
                                    },
                                    children: "RSRP:"
                                }), (0, i.jsxs)("span", {
                                    style: {
                                        background: h(r.rsrp, "rsrp"),
                                        color: "#fff",
                                        borderRadius: 2,
                                        flex: 1,
                                        padding: "0",
                                        fontSize: 12,
                                        height: 22,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    },
                                    children: [ void 0 !== r.rsrp ? `${r.rsrp}dBm` : "-", " ", b(r.rsrp, "rsrp") ]
                                }) ]
                            }), (0, i.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: 0,
                                    width: "100%"
                                },
                                children: [ (0, i.jsx)("span", {
                                    style: {
                                        width: 32,
                                        fontSize: 12,
                                        textAlign: "left",
                                        marginRight: 8
                                    },
                                    children: "RSRQ:"
                                }), (0, i.jsxs)("span", {
                                    style: {
                                        background: h(r.rsrq, "rsrq"),
                                        color: "#fff",
                                        borderRadius: 2,
                                        flex: 1,
                                        padding: "0",
                                        fontSize: 12,
                                        height: 22,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    },
                                    children: [ void 0 !== r.rsrq ? `${r.rsrq}dB` : "-", " ", b(r.rsrq, "rsrq") ]
                                }) ]
                            }), void 0 !== r.sinr ? (0, i.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: 0,
                                    width: "100%"
                                },
                                children: [ (0, i.jsx)("span", {
                                    style: {
                                        width: 32,
                                        fontSize: 12,
                                        textAlign: "left",
                                        marginRight: 8
                                    },
                                    children: "SINR:"
                                }), (0, i.jsxs)("span", {
                                    style: {
                                        background: h(r.sinr, "sinr"),
                                        color: "#fff",
                                        borderRadius: 2,
                                        flex: 1,
                                        padding: "0",
                                        fontSize: 12,
                                        height: 22,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    },
                                    children: [ `${r.sinr}dB`, " ", b(r.sinr, "sinr") ]
                                }) ]
                            }) : void 0 !== r.rssi ? (0, i.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: 0,
                                    width: "100%"
                                },
                                children: [ (0, i.jsx)("span", {
                                    style: {
                                        width: 32,
                                        fontSize: 12,
                                        textAlign: "left",
                                        marginRight: 8
                                    },
                                    children: "RSSI:"
                                }), (0, i.jsxs)("span", {
                                    style: {
                                        background: h(r.rssi, "rssi"),
                                        color: "#fff",
                                        borderRadius: 2,
                                        flex: 1,
                                        padding: "0",
                                        fontSize: 12,
                                        height: 22,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    },
                                    children: [ `${r.rssi}dBm`, " ", b(r.rssi, "rssi") ]
                                }) ]
                            }) : null ]
                        }) ]
                    }, n)) ]
                })
            });
        }
    }
} ]);
