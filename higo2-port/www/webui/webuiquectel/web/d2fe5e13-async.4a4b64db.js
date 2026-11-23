(("undefined" != typeof globalThis ? globalThis : self)["makoChunk_ant-design-pro"] = ("undefined" != typeof globalThis ? globalThis : self)["makoChunk_ant-design-pro"] || []).push([ [ "d2fe5e13" ], {
    "7712ee51": function(e, t, r) {
        r.d(t, "__esModule", {
            value: !0
        }), r.e(t, {
            default: function() {
                return ev;
            }
        });
        var n = r("777fffbe"), i = r("852bbaa9"), o = r("11dc3ea2"), a = r("1753090e"), l = n._(a), d = r("c9e87c3f"), s = n._(d), c = r("04149813"), u = n._(c), p = r("a039a623"), m = n._(p), f = r("7c65f927"), v = n._(f), g = r("a233d566"), h = n._(g), b = r("c5a75afc"), x = n._(b), C = r("abacb86d"), S = n._(C), A = r("fbd94dbf"), T = n._(A), y = r("a48a9352"), M = n._(y), N = r("fb3f0ec0"), R = r("6547ef88"), _ = n._(R), Q = r("493d19be"), w = r("58555f08"), j = r("e9813f77"), G = i._(j), P = r("c7ace3f8"), E = r("87ffa1c6"), z = r("3923abf8"), D = n._(z), I = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"
                    }
                }, {
                    tag: "path",
                    attrs: {
                        d: "M686.7 638.6L544.1 535.5V288c0-4.4-3.6-8-8-8H488c-4.4 0-8 3.6-8 8v275.4c0 2.6 1.2 5 3.3 6.5l165.4 120.6c3.6 2.6 8.6 1.8 11.2-1.7l28.6-39c2.6-3.7 1.8-8.7-1.8-11.2z"
                    }
                } ]
            },
            name: "clock-circle",
            theme: "outlined"
        }, O = r("c798381f"), L = n._(O);
        // QNWCFG CSI is RAT-scoped, not a per-CC array. Match it through
        // QENG's serving frequency; never repeat one sample on every SCC.
        function quectelCSIFamily(carrier) {
            const rat = String(carrier.rat || carrier.band || "").toUpperCase();
            if (/NR|5G|^N\d/.test(rat)) return "nr5g";
            if (/LTE|^B\d/.test(rat)) return "lte";
            return "";
        }
        function quectelCSIFields(raw, name) {
            for (const line of String(raw || "").split(/\r?\n/)) {
                const match = line.match(/^\s*\+QNWCFG:\s*"([^"]+)"\s*,\s*(.*?)\s*$/i);
                if (match && match[1].toLowerCase() === name.toLowerCase()) {
                    return match[2].split(",").map(value => value.trim());
                }
            }
            return [];
        }
        function quectelCSIInteger(value, maximum) {
            if (!/^\d+$/.test(String(value))) return "-";
            const number = Number(value);
            return Number.isSafeInteger(number) && number <= maximum ? number : "-";
        }
        async function queryQuectelCarrierCSI(send, session, serving) {
            session.retryAfter ||= new Map();
            session.enabled ||= new Set();
            const read = async name => {
                if (Date.now() < (session.retryAfter.get(name) || 0)) return [];
                try {
                    const raw = await send(`AT+QNWCFG="${name}"`);
                    const fields = quectelCSIFields(raw, name);
                    // ERROR can mean idle/unavailable as well as unsupported.
                    // Back off, then retry so a later data session can recover.
                    if (!fields.length && /(?:^|\r?\n)(?:ERROR|\+CME ERROR:)/.test(String(raw))) session.retryAfter.set(name, Date.now() + 60000);
                    return fields;
                } catch (error) {
                    if (/\bERROR\b|not supported|unsupported/i.test(String(error))) session.retryAfter.set(name, Date.now() + 60000);
                    return [];
                }
            };
            let control = await read("csi_ctrl");
            if (control.length === 2 && control.every(value => /^[01]$/.test(value)) && control.includes("0") && !session.enabled.has("csi_ctrl")) {
                session.enabled.add("csi_ctrl");
                try {
                    await send('AT+QNWCFG="csi_ctrl",1,1');
                    control = await read("csi_ctrl");
                } catch { control = []; }
            }
            const result = {control, families: {}};
            const families = new Set(Object.values(serving.byEarfcn || {}).map(quectelCSIFamily).filter(Boolean));
            for (const family of families) {
                const sample = {csi: await read(`${family}_csi`)};
                for (const direction of ["dl", "ul"]) {
                    const name = `${family}_${direction}MCS`;
                    let fields = await read(name);
                    // U-series requires an explicit acquisition enable. Only
                    // write it after a supported query reports disabled.
                    if (fields[0] === "0" && !session.enabled.has(name)) {
                        session.enabled.add(name);
                        try { await send(`AT+QNWCFG="${name}",1`); fields = await read(name); } catch { fields = []; }
                    }
                    sample[direction] = fields;
                }
                result.families[family] = sample;
            }
            return result;
        }
        function mergeQuectelCarrierCSI(aggregation, serving, samples) {
            const result = {...aggregation, scc: (aggregation.scc || []).map(carrier => ({...carrier}))};
            if (aggregation.pcc) result.pcc = {...aggregation.pcc};
            // SA without CA can have QENG data but no QCAINFO PCC record.
            if (!result.pcc && serving.earfcn != null && serving.earfcn !== "" && quectelCSIFamily(serving) &&
                !result.scc.some(carrier => String(carrier.earfcn) === String(serving.earfcn))) {
                result.pcc = {...serving};
                delete result.pcc.byEarfcn;
                delete result.pcc.infoArr;
            }
            const carriers = [result.pcc, ...result.scc].filter(Boolean);
            for (const carrier of carriers) {
                Object.assign(carrier, {dl_mcs: "-", ul_mcs: "-", ri: "-", pmi: "-", csi_status: "-", dl_modulation: "-", ul_modulation: "-"});
                carrier.cqi = carrier.cqi ?? "-";
                carrier.dl_bw ??= carrier.dl_bandwidth ?? carrier.nr_dl_bandwidth ?? carrier.bw ?? "-";
                carrier.ul_bw ??= carrier.ul_bandwidth ?? carrier.nr_ul_bandwidth ?? "-";
            }
            for (const [family, sample] of Object.entries(samples.families || {})) {
                const cells = Object.values(serving.byEarfcn || {}).filter(cell => quectelCSIFamily(cell) === family);
                if (cells.length !== 1) continue;
                const cell = cells[0];
                const targets = carriers.filter(carrier => String(carrier.earfcn) === String(cell.earfcn) &&
                    (!quectelCSIFamily(carrier) || quectelCSIFamily(carrier) === family) &&
                    (carrier.pci == null || cell.pci == null || String(carrier.pci) === String(cell.pci)));
                if (targets.length !== 1) continue;
                const carrier = targets[0], enabled = samples.control?.[family === "lte" ? 0 : 1];
                carrier.csi_status = enabled === "1" ? "已开启" : enabled === "0" ? "未开启" : "-";
                if (enabled !== "0" && sample.csi?.length === 4) {
                    carrier.dl_mcs = quectelCSIInteger(sample.csi[0], 31);
                    carrier.ri = quectelCSIInteger(sample.csi[1], 8);
                    carrier.cqi = quectelCSIInteger(sample.csi[2], 15);
                    carrier.pmi = quectelCSIInteger(sample.csi[3], 65535);
                }
                for (const direction of ["dl", "ul"]) {
                    const values = sample[direction];
                    if (values?.length === 3 && values[0] === "1") {
                        const mcs = quectelCSIInteger(values[1], 31);
                        if (mcs !== "-") {
                            carrier[`${direction}_mcs`] = mcs;
                            carrier[`${direction}_modulation`] = {1: "BPSK", 2: "QPSK", 4: "16QAM", 6: "64QAM", 8: "256QAM"}[values[2]] || "-";
                        }
                    }
                }
            }
            return result;
        }
        function W() {
            return (W = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let k = G.forwardRef(((e, t) => G.createElement(L.default, W({}, e, {
            ref: t,
            icon: I
        }))));
        var H = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M518.3 459a8 8 0 00-12.6 0l-112 141.7a7.98 7.98 0 006.3 12.9h73.9V856c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V613.7H624c6.7 0 10.4-7.7 6.3-12.9L518.3 459z"
                    }
                }, {
                    tag: "path",
                    attrs: {
                        d: "M811.4 366.7C765.6 245.9 648.9 160 512.2 160S258.8 245.8 213 366.6C127.3 389.1 64 467.2 64 560c0 110.5 89.5 200 199.9 200H304c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8h-40.1c-33.7 0-65.4-13.4-89-37.7-23.5-24.2-36-56.8-34.9-90.6.9-26.4 9.9-51.2 26.2-72.1 16.7-21.3 40.1-36.8 66.1-43.7l37.9-9.9 13.9-36.6c8.6-22.8 20.6-44.1 35.7-63.4a245.6 245.6 0 0152.4-49.9c41.1-28.9 89.5-44.2 140-44.2s98.9 15.3 140 44.2c19.9 14 37.5 30.8 52.4 49.9 15.1 19.3 27.1 40.7 35.7 63.4l13.8 36.5 37.8 10C846.1 454.5 884 503.8 884 560c0 33.1-12.9 64.3-36.3 87.7a123.07 123.07 0 01-87.6 36.3H720c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h40.1C870.5 760 960 670.5 960 560c0-92.7-63.1-170.7-148.6-193.3z"
                    }
                } ]
            },
            name: "cloud-upload",
            theme: "outlined"
        };
        function $() {
            return ($ = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let q = G.forwardRef(((e, t) => G.createElement(L.default, $({}, e, {
            ref: t,
            icon: H
        }))));
        var B = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M624 706.3h-74.1V464c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v242.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.7a8 8 0 0012.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9z"
                    }
                }, {
                    tag: "path",
                    attrs: {
                        d: "M811.4 366.7C765.6 245.9 648.9 160 512.2 160S258.8 245.8 213 366.6C127.3 389.1 64 467.2 64 560c0 110.5 89.5 200 199.9 200H304c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8h-40.1c-33.7 0-65.4-13.4-89-37.7-23.5-24.2-36-56.8-34.9-90.6.9-26.4 9.9-51.2 26.2-72.1 16.7-21.3 40.1-36.8 66.1-43.7l37.9-9.9 13.9-36.6c8.6-22.8 20.6-44.1 35.7-63.4a245.6 245.6 0 0152.4-49.9c41.1-28.9 89.5-44.2 140-44.2s98.9 15.3 140 44.2c19.9 14 37.5 30.8 52.4 49.9 15.1 19.3 27.1 40.7 35.7 63.4l13.8 36.5 37.8 10C846.1 454.5 884 503.8 884 560c0 33.1-12.9 64.3-36.3 87.7a123.07 123.07 0 01-87.6 36.3H720c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h40.1C870.5 760 960 670.5 960 560c0-92.7-63.1-170.7-148.6-193.3z"
                    }
                } ]
            },
            name: "cloud-download",
            theme: "outlined"
        };
        function F() {
            return (F = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let U = G.forwardRef(((e, t) => G.createElement(L.default, F({}, e, {
            ref: t,
            icon: B
        }))));
        var K = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M868 545.5L536.1 163a31.96 31.96 0 00-48.3 0L156 545.5a7.97 7.97 0 006 13.2h81c4.6 0 9-2 12.1-5.5L474 300.9V864c0 4.4 3.6 8 8 8h60c4.4 0 8-3.6 8-8V300.9l218.9 252.3c3 3.5 7.4 5.5 12.1 5.5h81c6.8 0 10.5-8 6-13.2z"
                    }
                } ]
            },
            name: "arrow-up",
            theme: "outlined"
        };
        function V() {
            return (V = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let X = G.forwardRef(((e, t) => G.createElement(L.default, V({}, e, {
            ref: t,
            icon: K
        }))));
        var Z = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M862 465.3h-81c-4.6 0-9 2-12.1 5.5L550 723.1V160c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v563.1L255.1 470.8c-3-3.5-7.4-5.5-12.1-5.5h-81c-6.8 0-10.5 8.1-6 13.2L487.9 861a31.96 31.96 0 0048.3 0L868 478.5c4.5-5.2.8-13.2-6-13.2z"
                    }
                } ]
            },
            name: "arrow-down",
            theme: "outlined"
        };
        function Y() {
            return (Y = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let J = G.forwardRef(((e, t) => G.createElement(L.default, Y({}, e, {
            ref: t,
            icon: Z
        }))));
        var ee = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M744 62H280c-35.3 0-64 28.7-64 64v768c0 35.3 28.7 64 64 64h464c35.3 0 64-28.7 64-64V126c0-35.3-28.7-64-64-64zm-8 824H288V134h448v752zM472 784a40 40 0 1080 0 40 40 0 10-80 0z"
                    }
                } ]
            },
            name: "mobile",
            theme: "outlined"
        };
        function et() {
            return (et = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let er = G.forwardRef(((e, t) => G.createElement(L.default, et({}, e, {
            ref: t,
            icon: ee
        }))));
        var en = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 632H136V232h752v560zM610.3 476h123.4c1.3 0 2.3-3.6 2.3-8v-48c0-4.4-1-8-2.3-8H610.3c-1.3 0-2.3 3.6-2.3 8v48c0 4.4 1 8 2.3 8zm4.8 144h185.7c3.9 0 7.1-3.6 7.1-8v-48c0-4.4-3.2-8-7.1-8H615.1c-3.9 0-7.1 3.6-7.1 8v48c0 4.4 3.2 8 7.1 8zM224 673h43.9c4.2 0 7.6-3.3 7.9-7.5 3.8-50.5 46-90.5 97.2-90.5s93.4 40 97.2 90.5c.3 4.2 3.7 7.5 7.9 7.5H522a8 8 0 008-8.4c-2.8-53.3-32-99.7-74.6-126.1a111.8 111.8 0 0029.1-75.5c0-61.9-49.9-112-111.4-112s-111.4 50.1-111.4 112c0 29.1 11 55.5 29.1 75.5a158.09 158.09 0 00-74.6 126.1c-.4 4.6 3.2 8.4 7.8 8.4zm149-262c28.5 0 51.7 23.3 51.7 52s-23.2 52-51.7 52-51.7-23.3-51.7-52 23.2-52 51.7-52z"
                    }
                } ]
            },
            name: "idcard",
            theme: "outlined"
        };
        function ei() {
            return (ei = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let eo = G.forwardRef(((e, t) => G.createElement(L.default, ei({}, e, {
            ref: t,
            icon: en
        }))));
        var ea = {
            icon: {
                tag: "svg",
                attrs: {
                    viewBox: "64 64 896 896",
                    focusable: "false"
                },
                children: [ {
                    tag: "path",
                    attrs: {
                        d: "M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-792 72h752v120H136V232zm752 560H136V440h752v352zm-237-64h165c4.4 0 8-3.6 8-8v-72c0-4.4-3.6-8-8-8H651c-4.4 0-8 3.6-8 8v72c0 4.4 3.6 8 8 8z"
                    }
                } ]
            },
            name: "credit-card",
            theme: "outlined"
        };
        function el() {
            return (el = Object.assign ? Object.assign.bind() : function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var r = arguments[t];
                    for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (e[n] = r[n]);
                }
                return e;
            }).apply(this, arguments);
        }
        let ed = G.forwardRef(((e, t) => G.createElement(L.default, el({}, e, {
            ref: t,
            icon: ea
        }))));
        var es = r("774d4dd8"), ec = n._(es), eu = r("612a65fd"), ep = r("fd42a6c4"), em = r("ee1a1d47");
        let ef = `\n  .transparent-input-number .ant-input-number-handler-wrap {\n    background: transparent !important;\n  }\n  .transparent-input-number .ant-input-number-handler-up {\n    background: transparent !important;\n    border: none !important;\n  }\n  .transparent-input-number .ant-input-number-handler-down {\n    background: transparent !important;\n    border: none !important;\n  }\n`;
        ef += "\n.modem-auto-refresh .ant-input-number-actions{display:flex!important;opacity:1!important;visibility:visible!important;width:22px!important;height:100%!important;transform:none!important;pointer-events:auto!important;}\n.modem-auto-refresh .ant-input-number-action{display:flex!important;opacity:1!important;visibility:visible!important;height:50%!important;align-items:center!important;justify-content:center!important;}\n.modem-auto-refresh .ant-input-number{padding-right:22px!important;background:transparent;}\n.modem-auto-refresh .ant-input-number-input{text-align:center;color:var(--ant-color-primary);padding-right:0!important;}\n";
        if ("undefined" != typeof document) {
            let e = document.createElement("style");
            e.textContent = ef, document.head.appendChild(e);
        }
        let cellularAvailabilityCache = {
            key: "",
            checkedAt: 0,
            result: null,
            pending: null
        };
        async function checkCellularAvailability(e, t, r = !1) {
            let n = `${e || ""}:${t || ""}`, i = Date.now();
            if (!r && cellularAvailabilityCache.key === n) {
                if (cellularAvailabilityCache.pending) return cellularAvailabilityCache.pending;
                if (cellularAvailabilityCache.result && i - cellularAvailabilityCache.checkedAt < 1e3) return cellularAvailabilityCache.result;
            }
            let o = (async () => {
                try {
                    await (0, Q.ensureGroupReady)(e, t);
                    let r = await (0, Q.getCurrentGroupAsync)(e, t), n = await (0, Q.safeSendAT)((0, 
                    N.getAirplaneCmd)(r));
                    if ((0, N.parseAirplane)(n, r)) return {
                        available: !1,
                        reason: "飞行模式"
                    };
                    let i = String(await (0, Q.safeSendAT)("AT+CPIN?") || "");
                    if (/\+CPIN:\s*READY/i.test(i)) return {
                        available: !0,
                        reason: ""
                    };
                    if (/\+CME ERROR:\s*(10|13)\b/i.test(i) || /SIM\s+(NOT\s+INSERTED|NOT\s+PRESENT|ABSENT)/i.test(i)) return {
                        available: !1,
                        reason: "未检测到SIM卡"
                    };
                    if (/\+CPIN:/i.test(i)) return {
                        available: !1,
                        reason: "SIM卡未就绪"
                    };
                } catch (e) {
                    console.warn("检测蜂窝可用状态失败:", e);
                }
                return null;
            })();
            cellularAvailabilityCache = {
                key: n,
                checkedAt: i,
                result: cellularAvailabilityCache.key === n ? cellularAvailabilityCache.result : null,
                pending: o
            };
            let a = await o;
            return cellularAvailabilityCache.key === n && (cellularAvailabilityCache.checkedAt = Date.now(), 
            a && (cellularAvailabilityCache.result = a), cellularAvailabilityCache.pending = null), a;
        }
        function ev() {
            let {ip: e, port: t} = (0, w.useWebSocketConfig)(), {setInitialState: r} = (0, eu.useModel)("@@initialState");
            (0, ep.useScrollReset)();
            let [n, i] = (0, G.useState)("Quectel_AT"), [cellularAvailability, setCellularAvailability] = (0, 
            G.useState)({
                available: !1,
                reason: "正在检测SIM卡"
            });
            return (0, G.useEffect)((() => {
                e && t && "open" !== _.default.getStatus() && _.default.connect(`${location.protocol === "https:" ? "wss" : "ws"}://${e}:${t}`);
                let n = async () => {
                    await (0, Q.ensureGroupReady)(e, t);
                    let n = await (0, Q.safeSendAT)("ATI"), {model: i} = (0, N.parseATISystemInfo)(n);
                    r((e => ({
                        ...e,
                        dynamicTitle: i ? `${i}` : "Modem-Manager"
                    })));
                };
                return n(), () => {
                    _.default.removeOnOpenCallback(n);
                };
            }), [ e, t ]), (0, G.useEffect)((() => {
                let r = !1, n = null, i = async () => {
                    let n = await checkCellularAvailability(e, t, !0);
                    r || !n || setCellularAvailability(n);
                };
                return i(), n = setInterval(i, 3e3), () => {
                    r = !0, n && clearInterval(n);
                };
            }), [ e, t ]), (0, o.jsxs)(l.default, {
                gutter: [ 16, 16 ],
                align: "stretch",
                children: [ (0, o.jsx)(s.default, {
                    xs: 24,
                    md: 24,
                    children: (0, o.jsx)(eg, {
                        cellularAvailability: cellularAvailability
                    })
                }), (0, o.jsx)(s.default, {
                    xs: 24,
                    md: 24,
                    children: (0, o.jsx)(eN, {
                        cellularAvailability: cellularAvailability
                    })
                }), (0, o.jsx)(s.default, {
                    xs: 24,
                    md: 12,
                    children: (0, o.jsx)(eh, {
                        cellularAvailability: cellularAvailability
                    })
                }), (0, o.jsx)(s.default, {
                    xs: 24,
                    md: 12,
                    children: (0, o.jsx)(ey, {
                        lastStartTime: 0,
                        initUp: 0,
                        initDown: 0,
                        cellularAvailability: cellularAvailability
                    })
                }), (0, o.jsx)(s.default, {
                    xs: 24,
                    children: (0, o.jsx)(eM, {})
                }) ]
            });
        }
        function eg({cellularAvailability: cellularAvailability}) {
            let [e, t] = (0, G.useState)(!0), [r, n] = (0, G.useState)(()=>{try{return Math.max(1,Math.min(60,Number(localStorage.getItem("modemwebui.networkInfo.interval"))||5));}catch(error){return 5;}}), i = (0, G.useRef)(null), a = (0, 
            G.useRef)(null), d = (0, G.useRef)(null), c = (0, G.useRef)(null);
            return (0, G.useEffect)((() => {
                if (!e) {
                    i.current && clearInterval(i.current);
                    return;
                }
                return i.current = setInterval((() => {
                    var e, t, r, n, i, o;
                    null === (t = a.current) || void 0 === t || null === (e = t.refresh) || void 0 === e || e.call(t), 
                    null === (n = d.current) || void 0 === n || null === (r = n.refresh) || void 0 === r || r.call(n), 
                    null === (o = c.current) || void 0 === o || null === (i = o.refresh) || void 0 === i || i.call(o);
                }), 1e3 * r), () => {
                    i.current && clearInterval(i.current);
                };
            }), [ e, r ]), (0, o.jsx)(u.default, {
                className: "my-card",
                style: {},
                title: (0, o.jsxs)("span", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: [ (0, o.jsx)("span", {
                        style: {
                            lineHeight: "32px"
                        },
                        children: "网络信息"
                    }), null ]
                }),
                extra: (0, o.jsxs)(m.default, {
 type: "link", size: "small", className: "modem-auto-refresh",
 style: {padding:"0 8px",height:"28px",display:"flex",alignItems:"center",gap:"4px",background:e?"#e6f7ff":"transparent",border:"1px solid #91d5ff",borderRadius:"4px"},
 onClick: event => {if(!event.target.closest(".ant-input-number")) t(!e);},
 children: [(0,o.jsx)("span",{children:"自动刷新"}), e && (0,o.jsx)(S.default,{
 min:1,max:60,value:r,onChange:next=>{if(next!==null&&next!==undefined){const seconds=Math.max(1,Math.min(60,Number(next)));n(seconds);try{localStorage.setItem("modemwebui.networkInfo.interval",String(seconds));}catch(error){}}},
 style:{width:45},size:"small",bordered:!1
 }), e && (0,o.jsx)("span",{children:"秒"})]
}),
                children: (0, o.jsxs)(l.default, {
                    gutter: [ 14, 14 ],
                    children: [ (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 16,
                        children: (0, o.jsx)(eS, {
                            ref: a,
                            cellularAvailability: cellularAvailability
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 8,
                        children: (0, o.jsx)(eA, {
                            ref: d,
                            cellularAvailability: cellularAvailability
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 24,
                        children: (0, o.jsx)(eT, {
                            ref: c,
                            cellularAvailability: cellularAvailability
                        })
                    }) ]
                })
            });
        }
        function eh({cellularAvailability: cellularAvailability}) {
            const [rateError, setRateError] = (0, G.useState)("");
            let {ip: e, port: t} = (0, w.useWebSocketConfig)(), [r, n] = (0, G.useState)((() => {
                try {
                    return window.localStorage.getItem("modemwebui.realtime-rate.enabled") === "1";
                } catch {
                    return !1;
                }
            })), [i, a] = (0, G.useState)(!1), [l, d] = (0, G.useState)(500), [s, c] = (0, G.useState)(null), [p, m] = (0, 
            G.useState)(null), [f, v] = (0, G.useState)(""), [g, b] = (0, G.useState)(""), [C, A] = (0, 
            G.useState)(""), T = (0, G.useRef)(null), realtimeBusy = (0, G.useRef)(false), saveRealtimeRatePreference = e => {
                try {
                    window.localStorage.setItem("modemwebui.realtime-rate.enabled", e ? "1" : "0");
                } catch {}
                fetch("/realtime-rate.json", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        enabled: !!e
                    })
                }).catch((e => {
                    console.error("保存实时速率开关状态失败:", e);
                }));
            }, y = async () => {
                if (!cellularAvailability.available) return m(null), b("");
                try {
                    await (0, Q.ensureGroupReady)(e, t);
                    let r = await (0, Q.getCurrentGroupAsync)(e, t);
                    A(r);
                    let n = (0, N.getSignedRateCmds)(r), i = [];
                    for (let e of n) i.push(await (0, Q.safeSendAT)(e));
                    let o = (0, N.parseSignedRate)(i, r);
                    m(o), b((null == o ? void 0 : o.apn) || "");
                } catch {}
            }, M = async () => {
                if (!cellularAvailability.available) return v("");
                try {
                    await (0, Q.ensureGroupReady)(e, t);
                    let r = await (0, Q.getCurrentGroupAsync)(e, t), n = (0, N.getOperatorCmd)(r), i = [];
                    for (let e of n) i.push(await (0, Q.safeSendAT)(e));
                    v((0, N.parseOperator)(i, r) || "");
                } catch {}
            };
            (0, G.useEffect)((() => {
                cellularAvailability.available || (c(null), m(null), v(""), b(""));
            }), [ cellularAvailability.available ]);
            (0, G.useEffect)((() => {
                let e = !0;
                return fetch("/realtime-rate.json", {
                    cache: "no-store"
                }).then((e => e.ok ? e.json() : Promise.reject())).then((t => {
                    if (e && "boolean" == typeof t.enabled) {
                        n(t.enabled);
                        try {
                            window.localStorage.setItem("modemwebui.realtime-rate.enabled", t.enabled ? "1" : "0");
                        } catch {}
                    }
                })).catch((() => {})), () => {
                    e = !1;
                };
            }), []);
            return (0, G.useEffect)((() => {
                let e = !1, t = () => {
                    e || (y(), M());
                };
                return _.default.getStatus && "open" === _.default.getStatus() ? t() : _.default.addOnOpenCallback(t), 
                () => {
                    e = !0, _.default.removeOnOpenCallback(t);
                };
            }), [ e, t, cellularAvailability.available ]), (0, G.useEffect)((() => {
                if (!r) {
                    c(null), setRateError(""), T.current && clearInterval(T.current);
                    return;
                }
                let active = true;let rateRequest=null;
                const hide=()=>{if(document.hidden)rateRequest?.abort();};document.addEventListener("visibilitychange",hide);
                async function n() {
                    if (!active || document.hidden || realtimeBusy.current) return;
                    realtimeBusy.current=true;const request=new AbortController();rateRequest=request;const timeout=setTimeout(()=>request.abort(),3500);
                    try {
                        const response=await fetch('/api/cpe/network/rate',{cache:'no-store',signal:request.signal});
                        const value=await response.json();if(!active||request.signal.aborted)return;
                        if(!response.ok||!value.available)throw Error(value.reason||'蜂窝速率暂不可用');
                        setRateError(value.warming_up?'正在采集速率样本…':'');
                        c(value.available&&value.realtime_supported&&Number.isFinite(value.up_bps)&&Number.isFinite(value.down_bps)?{up:value.up_bps,down:value.down_bps}:null);
                    }catch(error){if(active&&!request.signal.aborted){c(null);setRateError(String(error&&error.message||'蜂窝速率读取失败'));}}
                    finally{clearTimeout(timeout);if(rateRequest===request)rateRequest=null;realtimeBusy.current=false;}
                }
                const timer = setInterval(n, l);
                T.current = timer;
                n();
                return () => {
                    active = false;rateRequest?.abort();document.removeEventListener("visibilitychange",hide);
                    clearInterval(timer);
                    if (T.current === timer) T.current = null;
                };
            }), [ r, l, e, t, cellularAvailability.available ]), (0, o.jsxs)(u.default, {
                className: "my-card",
                title: (0, o.jsxs)(o.Fragment, {
                    children: [ (0, o.jsx)("span", {
                        children: "网络速率信息"
                    }), null ]
                }),
                extra: (0, o.jsx)(x.default, {
                    checked: r,
                    onChange: e => {
                        e ? a(!0) : (saveRealtimeRatePreference(!1), n(!1));
                    },
                    checkedChildren: "实时网速开启",
                    unCheckedChildren: "实时网速关闭"
                }),
                style: {
                    marginTop: 0
                },
                styles: {
                    body: {
                        padding: 24
                    }
                },
                children: [ r && rateError && (0, o.jsx)("div", {role:"status", style:{marginBottom:12,color:"var(--ant-color-warning)"},children:rateError}), (0, o.jsx)(eb, {
                    showRealtime: r,
                    realtimeRate: s,
                    cellularAvailability: cellularAvailability,
                    onSwitch: e => {
                        e ? a(!0) : (saveRealtimeRatePreference(!1), n(!1));
                    }
                }), (0, o.jsx)(ex, {
                    signedRate: p,
                    operator: f,
                    apn: g,
                    cellularAvailability: cellularAvailability
                }), (0, o.jsxs)(h.default, {
                    title: "主动刷新时间",
                    open: i,
                    onCancel: () => {
                        a(!1), saveRealtimeRatePreference(!1), n(!1);
                    },
                    onOk: () => {
                        a(!1), saveRealtimeRatePreference(!0), n(!0);
                    },
                    okText: "确定",
                    cancelText: "取消",
                    styles: {
                        footer: {
                            textAlign: "right"
                        }
                    },
                    okButtonProps: {
                        className: "my-btn",
                        type: "primary"
                    },
                    cancelButtonProps: {
                        className: "my-btn"
                    },
                    children: [ (0, o.jsxs)("div", {
                        style: {
                            marginTop: 16,
                            marginBottom: 12
                        },
                        children: [ "主动刷新时间（", "Quectel_AT" === C ? "1500" : "200", "-65535ms）：" ]
                    }), (0, o.jsx)(S.default, {
                        min: "Quectel_AT" === C ? 1500 : 200,
                        max: 65535,
                        value: l,
                        onChange: e => d(Number(e) || ("Quectel_AT" === C ? 1500 : 200)),
                        addonAfter: "ms",
                        style: {
                            width: "100%",
                            alignItems: "center"
                        }
                    }), (0, o.jsx)("div", {
                        style: {
                            marginTop: 12,
                            marginBottom: 16,
                            color: "var(--ant-color-text-secondary)",
                            fontSize: 12
                        },
                        children: "说明：间隔越小，数据更新越频繁，但系统负担越大"
                    }) ]
                }) ]
            });
        }
        function eb({showRealtime: e, realtimeRate: t, onSwitch: r, cellularAvailability: cellularAvailability}) {
            let {token: n} = T.default.useToken(), i = "#ffffff" !== n.colorBgContainer, a = e => i ? "var(--ant-color-success)" === e ? "linear-gradient(135deg, #389e0d 0%, #52c41a 100%)" : "var(--ant-color-primary)" === e ? "linear-gradient(135deg, #0958d9 0%, #1890ff 100%)" : "linear-gradient(135deg, #d46b08 0%, #fa8c16 100%)" : "var(--ant-color-success)" === e ? "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)" : "var(--ant-color-primary)" === e ? "linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)" : "linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)", d = (0, 
            P.getSpeedColor)(t ? t.up : 0), c = (0, P.getSpeedColor)(t ? t.down : 0), p = a(d), m = a(c);
            return (0, o.jsxs)("div", {
                style: {
                    position: "relative"
                },
                children: [ (0, o.jsx)(u.default, {
                    className: "my-inline-card quectel-live-rate-card",
                    title: (0, o.jsx)("span", {
                        style: {
                            fontSize: 14
                        },
                        children: "实时网速"
                    }),
                    style: {
                        marginBottom: 24,
                        background: em.colors.bgSecondary,
                        boxShadow: "none",
                        border: "none",
                        opacity: e ? 1 : .2,
                        filter: e ? "none" : "grayscale(1)"
                    },
                    styles: {
                        body: {
                            padding: e ? "12px" : "24px",
                            minHeight: e ? "auto" : 134
                        }
                    },
                    children: e && (0, o.jsxs)(l.default, {
                        gutter: [ 12, 12 ],
                        style: {
                            padding: "0px"
                        },
                        children: [ (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 12,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: p,
                                    borderRadius: 4,
                                    padding: "16px",
                                    minHeight: "110px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)"
                                },
                                children: [ (0, o.jsx)(X, {
                                    style: {
                                        position: "absolute",
                                        top: 12,
                                        right: 12,
                                        fontSize: 64,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 26,
                                            fontWeight: "bold",
                                            color: "#fff",
                                            marginTop: 2,
                                            marginBottom: 8
                                        },
                                        children: t ? (0, P.formatSpeed)(t.up, !1) : "-"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 16,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "上行速率"
                                    }) ]
                                }) ]
                            })
                        }), (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 12,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: m,
                                    borderRadius: 4,
                                    padding: "16px",
                                    minHeight: "110px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)"
                                },
                                children: [ (0, o.jsx)(J, {
                                    style: {
                                        position: "absolute",
                                        top: 12,
                                        right: 12,
                                        fontSize: 64,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 26,
                                            fontWeight: "bold",
                                            color: "#fff",
                                            marginTop: 2,
                                            marginBottom: 8
                                        },
                                        children: t ? (0, P.formatSpeed)(t.down, !1) : "-"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 16,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "下行速率"
                                    }) ]
                                }) ]
                            })
                        }) ]
                    })
                }), !e && (0, o.jsx)("div", {
                    style: {
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        color: "var(--ant-color-text-secondary)",
                        opacity: 1,
                        zIndex: 10,
                        pointerEvents: "none"
                    },
                    children: "暂未开启实时网速监控"
                }) ]
            });
        }
        function ex({signedRate: e, operator: t, apn: r, cellularAvailability: cellularAvailability}) {
            return (0, o.jsx)(u.default, {
                className: "my-inline-card",
                style: {
                    background: em.colors.bgSecondary,
                    marginBottom: 0,
                    boxShadow: "none",
                    border: "none"
                },
                styles: {
                    body: {}
                },
                title: (0, o.jsx)("div", {
                    style: {
                        fontWeight: "bold",
                        fontSize: 14,
                        marginBottom: 0,
                        color: "var(--ant-color-text)",
                        background: "transparent"
                    },
                    children: "当前网络"
                }),
                children: (0, o.jsxs)(l.default, {
                    gutter: [ 12, 12 ],
                    style: {},
                    children: [ (0, o.jsx)(s.default, {
                        xs: 12,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                background: "var(--ant-color-bg-container)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                textAlign: "left",
                                width: "100%",
                                height: "100%",
                                boxShadow: "none"
                            },
                            children: [ (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-secondary)"
                                },
                                children: "上行速率"
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 16,
                                    color: "var(--ant-color-success)",
                                    fontWeight: 600,
                                    display: "inline-block"
                                },
                                children: cellularAvailability.available ? (null == e ? void 0 : e.up) || "-" : "-"
                            }), (0, o.jsx)("span", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text)",
                                    marginLeft: 4
                                },
                                children: cellularAvailability.available ? "Mbps" : ""
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 12,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                background: "var(--ant-color-bg-container)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                textAlign: "left",
                                width: "100%",
                                height: "100%",
                                boxShadow: "none"
                            },
                            children: [ (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-secondary)"
                                },
                                children: "下行速率"
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 16,
                                    color: "var(--ant-color-success)",
                                    fontWeight: 600,
                                    display: "inline-block"
                                },
                                children: cellularAvailability.available ? (null == e ? void 0 : e.down) || "-" : "-"
                            }), (0, o.jsx)("span", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text)",
                                    marginLeft: 4
                                },
                                children: cellularAvailability.available ? "Mbps" : ""
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 12,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                background: "var(--ant-color-bg-container)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                textAlign: "left",
                                width: "100%",
                                height: "100%",
                                boxShadow: "none"
                            },
                            children: [ (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-secondary)"
                                },
                                children: "APN"
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 14,
                                    fontWeight: 600
                                },
                                children: cellularAvailability.available ? r || "-" : "-"
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 12,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                background: "var(--ant-color-bg-container)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                textAlign: "left",
                                width: "100%",
                                height: "100%",
                                boxShadow: "none"
                            },
                            children: [ (0, o.jsx)("div", {
                                style: {
                                    color: "var(--ant-color-text-secondary)",
                                    fontSize: 12
                                },
                                children: "QCI (服务质量等级)"
                            }), (0, o.jsxs)("div", {
                                style: {
                                    fontSize: 14,
                                    fontWeight: 600
                                },
                                children: cellularAvailability.available ? [ "等级", (null == e ? void 0 : e.downQci) || "-" ] : "-"
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        span: 24,
                        children: (0, o.jsx)("div", {
                            style: {
                                background: "var(--ant-color-bg-container)",
                                borderRadius: 6,
                                padding: "8px 12px",
                                textAlign: "center",
                                width: "100%",
                                height: "100%",
                                boxShadow: "none"
                            },
                            children: (0, o.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center"
                                },
                                children: [ "中国移动" === t && (0, o.jsx)("img", {
                                    src: "/icons/china_mobile.png",
                                    alt: "中国移动",
                                    style: {
                                        width: 40,
                                        height: 40,
                                        marginRight: 16
                                    }
                                }), "中国联通" === t && (0, o.jsx)("img", {
                                    src: "/icons/china_unicom.png",
                                    alt: "中国联通",
                                    style: {
                                        width: 40,
                                        height: 40,
                                        marginRight: 16
                                    }
                                }), "中国电信" === t && (0, o.jsx)("img", {
                                    src: "/icons/china_telecom.png",
                                    alt: "中国电信",
                                    style: {
                                        width: 40,
                                        height: 40,
                                        marginRight: 16
                                    }
                                }), "中国广电" === t && (0, o.jsx)("img", {
                                    src: "/icons/china_broadcast.png",
                                    alt: "中国广电",
                                    style: {
                                        width: 40,
                                        height: 40,
                                        marginRight: 16
                                    }
                                }), "埃塞俄比亚电信" === t && (0, o.jsx)("img", {
                                    src: "/icons/ethio_telecom.png",
                                    alt: "埃塞俄比亚电信",
                                    style: {
                                        width: 40,
                                        height: 40,
                                        marginRight: 16
                                    }
                                }), t && ![ "中国移动", "中国联通", "中国电信", "中国广电", "埃塞俄比亚电信" ].includes(t) && (0, o.jsx)("img", {
                                    src: "/icons/unknow_operator.png",
                                    alt: "未知运营商",
                                    style: {
                                        width: 40,
                                        height: 40,
                                        marginRight: 16
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-start",
                                        justifyContent: "center"
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 12,
                                            color: "var(--ant-color-text-secondary)"
                                        },
                                        children: "运营商"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            fontWeight: "bold"
                                        },
                                        children: cellularAvailability.available ? t || "-" : "-"
                                    }) ]
                                }) ]
                            })
                        })
                    }) ]
                })
            });
        }
        function eC({level: e, color: t}) {
            let r = [ 8, 16, 24, 32 ];
            return (0, o.jsx)("span", {
                style: {
                    display: "inline-flex",
                    alignItems: "flex-end",
                    height: 36,
                    marginRight: 2
                },
                children: [ 1, 2, 3, 4 ].map((n => (0, o.jsx)("span", {
                    style: {
                        width: 8,
                        height: r[n - 1],
                        marginLeft: 3,
                        borderRadius: 1,
                        background: n <= e ? t : "var(--ant-color-fill-tertiary)",
                        display: "inline-block",
                        transition: "background 0.3s"
                    }
                }, n)))
            });
        }
        let eS = (0, G.forwardRef)((function({cellularAvailability: cellularAvailability}, t) {
            let {ip: r, port: n} = (0, w.useWebSocketConfig)(), [i, a] = (0, G.useState)(!0), [d, c] = (0, 
            G.useState)(null), [p, m] = (0, G.useState)(""), [f, g] = (0, G.useState)(void 0), [h, b] = (0, 
            G.useState)(-157), [x, C] = (0, G.useState)(-24), [S, A] = (0, G.useState)(-44), [y, R] = (0, 
            G.useState)([]), {message: j} = v.default.useApp(), {token: z} = T.default.useToken(), D = e => {
                if (r && n) try {
                    localStorage.setItem(`dashboard_signal_history_${r}_${n}`, JSON.stringify(e));
                } catch (e) {
                    console.error("保存信号历史数据失败:", e);
                }
            };
            (0, G.useEffect)((() => {
                if (r && n) try {
                    let e = localStorage.getItem(`dashboard_signal_history_${r}_${n}`);
                    if (e) {
                        let t = JSON.parse(e);
                        Array.isArray(t) && R(t.slice(-120));
                    }
                } catch (e) {
                    console.error("加载信号历史数据失败:", e);
                }
            }), [ r, n ]), (0, G.useImperativeHandle)(t, (() => ({
                refresh: I
            })), [ r, n ]);
            (0, G.useEffect)((() => {
                cellularAvailability.available || (c(null), m(""), g(void 0), b(-157), C(-24), A(-44), 
                R([]), D([]));
            }), [ cellularAvailability.available ]);
            let I = async () => {
                if (!cellularAvailability.available) return;
                a(!0);
                try {
                    var e, t, i;
                    let o;
                    await (0, Q.ensureGroupReady)(r, n);
                    let a = await (0, Q.getCurrentGroupAsync)(r, n), l = await (0, Q.safeSendAT)((0, 
                    N.getQRSRPCmd)(a)), d = await (0, Q.safeSendAT)((0, N.getQSINRCmd)(a)), s = await (0, 
                    Q.safeSendAT)((0, N.getQRSRQCmd)(a)), u = await (0, Q.safeSendAT)((0, N.getNetworkTypeCmd)(a));
                    for (let e of (0, N.getRegStatusCmd)(a)) {
                        let t = await (0, Q.safeSendAT)(e);
                        if (o = (0, N.parseRegStatus)(t, a)) break;
                    }
                    c({
                        qrsrp: (0, N.parseQRSRP)(l, a),
                        qsinr: (0, N.parseQSINR)(d, a),
                        qrsrq: (0, N.parseQRSRQ)(s, a)
                    });
                    let p = (null === (e = (0, N.parseQRSRP)(l, a)) || void 0 === e ? void 0 : e.value) ?? -157, f = (null === (t = (0, 
                    N.parseQSINR)(d, a)) || void 0 === t ? void 0 : t.value) ?? -24, v = (null === (i = (0, 
                    N.parseQRSRQ)(s, a)) || void 0 === i ? void 0 : i.value) ?? -44;
                    b(p), C(f), A(v), m((0, N.parseNetworkType)(u, a) ?? ""), g(o);
                    let h = {
                        rsrp: p,
                        sinr: f,
                        rsrq: v,
                        timestamp: (new Date).getTime()
                    };
                    R((e => {
                        let t = [ ...e.slice(-119), h ];
                        return D(t), t;
                    }));
                } catch (e) {
                    c(null); m(""); g(void 0);
                    j.error("信号查询失败: " + e);
                }
                a(!1);
            };
            (0, G.useEffect)((() => (_.default.getStatus && "open" === _.default.getStatus() ? I() : _.default.addOnOpenCallback(I), 
            () => {
                _.default.removeOnOpenCallback(I);
            })), [ r, n, cellularAvailability.available ]);
            let O = cellularAvailability.available ? (0, P.getSignalLevel)(h, "rsrp") : 0, L = cellularAvailability.available ? (0, 
            P.getSignalColor)(h, "rsrp") : "var(--ant-color-text-secondary)", W = "var(--ant-color-warning)", k = em.colors.bgOrange, H = cellularAvailability.available ? p || (i ? "正在读取网络" : "网络类型未返回") : cellularAvailability.reason;
            p && p.toUpperCase().includes("NR") ? (W = "var(--ant-color-success)", k = em.colors.bgGreen) : p && p.toUpperCase().includes("LTE") && (W = "var(--ant-color-primary)", 
            k = em.colors.bgBlue);
            let $ = cellularAvailability.available ? {
                0: {
                    text: "未注册，未搜索",
                    color: "var(--ant-color-error)",
                    bg: em.colors.bgRed
                },
                1: {
                    text: "已注册，本地网络",
                    color: "var(--ant-color-success)",
                    bg: em.colors.bgGreen
                },
                2: {
                    text: "未注册，正在搜索",
                    color: "var(--ant-color-warning)",
                    bg: em.colors.bgOrange
                },
                3: {
                    text: "注册被拒",
                    color: "var(--ant-color-error)",
                    bg: em.colors.bgRed
                },
                4: {
                    text: "未知（超出网络覆盖）",
                    color: "var(--ant-color-text-secondary)",
                    bg: "var(--ant-color-fill-tertiary)"
                },
                5: {
                    text: "已注册，漫游网络",
                    color: "var(--ant-color-primary)",
                    bg: em.colors.bgBlue
                },
                6: {
                    text: "已注册SMS only本地网络",
                    color: "var(--ant-color-success)",
                    bg: em.colors.bgGreen
                },
                7: {
                    text: "已注册SMS only漫游网络",
                    color: "var(--ant-color-success)",
                    bg: em.colors.bgGreen
                },
                8: {
                    text: "仅用于紧急承载服务",
                    color: "var(--ant-color-warning)",
                    bg: em.colors.bgOrange
                },
                9: {
                    text: "注册CSFB不优先本地网络",
                    color: "var(--ant-color-text-secondary)",
                    bg: em.colors.bgSecondary
                },
                10: {
                    text: "注册CSFB不优先漫游网络",
                    color: "var(--ant-color-text-secondary)",
                    bg: em.colors.bgSecondary
                }
            }[f] || {
                text: i ? "正在读取注册状态" : "注册状态未返回",
                color: "var(--ant-color-text-secondary)",
                bg: "var(--ant-color-fill-tertiary)"
            } : {
                text: cellularAvailability.reason,
                color: "var(--ant-color-text-secondary)",
                bg: "var(--ant-color-fill-tertiary)"
            }, q = cellularAvailability.available ? Math.max(0, Math.min(100, Math.round((h + 120) * 100 / 40))) : 0, B = y.map((e => e.rsrp ?? -157)), F = y.map((e => e.sinr ?? -24)), U = y.map((e => e.rsrq ?? -44)), K = B.length > 0 ? B : [ h ], V = F.length > 0 ? F : [ x ], X = U.length > 0 ? U : [ S ], Z = e => e.startsWith("var(") ? {
                "var(--ant-color-success)": z.colorSuccess,
                "var(--ant-color-warning)": z.colorWarning,
                "var(--ant-color-error)": z.colorError,
                "var(--ant-color-primary)": z.colorPrimary,
                "var(--ant-color-text-secondary)": z.colorTextSecondary
            }[e] || z.colorPrimary : e, Y = (e, t, r, n = "rsrp") => {
                let i, o, a = e;
                if (e.length < 10 || e.length > 0 && 1 === new Set(e).size) {
                    let t;
                    let n = e.length > 0 ? e[e.length - 1] : r;
                    t = n < 0 ? Math.max(1, .05 * Math.abs(n)) : Math.max(.5, .05 * n), a = Array.from({
                        length: 20
                    }, ((e, r) => n + (r / 20 - .5) * t * .5 + (Math.random() - .5) * t));
                }
                a.length > 50 && (a = a.slice(-50));
                let l = Z(t);
                "rsrp" === n ? (i = -157, o = Math.max(Math.max(...a, r) + 10, -30)) : "sinr" === n ? (i = -24, 
                o = Math.max(Math.max(...a, r) + 5, 40)) : (i = -44, o = Math.max(Math.max(...a, r) + 5, -5));
                let d = a, s = i, c = o;
                return d = a.map((e => e - i)), s = 0, c = o - i, {
                    data: d.map(((e, t) => ({
                        index: t,
                        value: Number(e.toFixed(2))
                    }))),
                    xField: "index",
                    yField: "value",
                    height: 40,
                    padding: [ 4, 4, 4, 4 ],
                    shapeField: "smooth",
                    color: l,
                    style: {
                        fill: l,
                        fillOpacity: .6
                    },
                    autoFit: !0,
                    smooth: !0,
                    animation: !1,
                    yAxis: {
                        min: s,
                        max: c,
                        label: !1
                    },
                    scale: {
                        value: {
                            domain: [ s, c ]
                        }
                    },
                    startOnZero: !0
                };
            };
            return (0, o.jsx)(u.default, {
                style: {},
                title: (0, o.jsxs)("div", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: [ (0, o.jsx)("span", {
                        style: {
                            fontSize: 14,
                            marginRight: 12
                        },
                        children: "信号看板"
                    }), (0, o.jsx)("span", {
                        style: {
                            background: k,
                            color: W,
                            borderRadius: 4,
                            fontSize: 12,
                            padding: "2px 8px",
                            marginRight: 8
                        },
                        children: H
                    }), (0, o.jsx)("span", {
                        style: {
                            background: $.bg,
                            color: $.color,
                            borderRadius: 4,
                            fontSize: 12,
                            padding: "2px 8px"
                        },
                        children: $.text
                    }) ]
                }),
                styles: {
                    header: {
                        background: em.colors.bgSecondary
                    },
                    body: {
                        padding: 12
                    }
                },
                className: "my-inline-card",
                children: (0, o.jsxs)(l.default, {
                    gutter: [ 12, 12 ],
                    style: {
                        display: "flex",
                        alignItems: "stretch",
                        minHeight: 144
                    },
                    children: [ (0, o.jsx)(s.default, {
                        xs: 24,
                        sm: 12,
                        md: 12,
                        lg: 6,
                        style: {
                            display: "flex"
                        },
                        children: (0, o.jsxs)(u.default, {
                            size: "small",
                            style: {
                                background: "var(--ant-color-bg-container)",
                                border: "1px solid var(--ant-color-border-secondary)",
                                borderRadius: 4,
                                width: "100%",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column"
                            },
                            styles: {
                                body: {
                                    padding: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    flex: 1,
                                    minHeight: 0
                                }
                            },
                            children: [ (0, o.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 4
                                },
                                children: [ (0, o.jsxs)("div", {
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "var(--ant-color-text-secondary)",
                                            marginBottom: 4,
                                            fontWeight: 600
                                        },
                                        children: "信号质量"
                                    }), (0, o.jsxs)("div", {
                                        style: {
                                            fontSize: 28,
                                            color: L,
                                            fontWeight: "bold"
                                        },
                                        children: cellularAvailability.available && d ? [ q, "%" ] : "-"
                                    }) ]
                                }), (0, o.jsx)(eC, {
                                    level: O,
                                    color: L
                                }) ]
                            }), (0, o.jsx)(M.default, {
                                percent: q,
                                strokeColor: L,
                                showInfo: !1,
                                style: {
                                    marginBottom: 4
                                }
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-tertiary)"
                                },
                                children: "信号强度指标"
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        sm: 12,
                        md: 12,
                        lg: 6,
                        style: {
                            display: "flex"
                        },
                        children: (0, o.jsxs)(u.default, {
                            size: "small",
                            style: {
                                background: "var(--ant-color-bg-container)",
                                border: "1px solid var(--ant-color-border-secondary)",
                                borderRadius: 4,
                                width: "100%",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column"
                            },
                            styles: {
                                body: {
                                    padding: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    flex: 1,
                                    minHeight: 0
                                }
                            },
                            children: [ (0, o.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 4
                                },
                                children: [ (0, o.jsxs)("div", {
                                    style: {
                                        marginBottom: 2
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "var(--ant-color-text-secondary)",
                                            marginBottom: 0,
                                            fontWeight: 600
                                        },
                                        children: "RSRP"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 12,
                                            color: "var(--ant-color-text-tertiary)"
                                        },
                                        children: "dBm"
                                    }) ]
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 28,
                                        color: (0, P.getSignalColor)(h, "rsrp"),
                                        fontWeight: "bold"
                                    },
                                    children: cellularAvailability.available && d ? h : "-"
                                }) ]
                            }), (0, o.jsx)("div", {
                                style: {
                                    marginBottom: 4,
                                    height: 36,
                                    width: "100%",
                                    minHeight: 36,
                                    position: "relative"
                                },
                                children: cellularAvailability.available && d ? (0, o.jsx)(E.Tiny.Area, {
                                    ...Y(K, (0, P.getSignalColor)(h, "rsrp"), h, "rsrp")
                                }) : null
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-tertiary)"
                                },
                                children: "参考信号接收功率"
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        sm: 12,
                        md: 12,
                        lg: 6,
                        style: {
                            display: "flex"
                        },
                        children: (0, o.jsxs)(u.default, {
                            size: "small",
                            style: {
                                background: "var(--ant-color-bg-container)",
                                border: "1px solid var(--ant-color-border-secondary)",
                                borderRadius: 4,
                                width: "100%",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column"
                            },
                            styles: {
                                body: {
                                    padding: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    flex: 1,
                                    minHeight: 0
                                }
                            },
                            children: [ (0, o.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 4
                                },
                                children: [ (0, o.jsxs)("div", {
                                    style: {
                                        marginBottom: 2
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "var(--ant-color-text-secondary)",
                                            marginBottom: 0,
                                            fontWeight: 600
                                        },
                                        children: "SINR"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 12,
                                            color: "var(--ant-color-text-tertiary)"
                                        },
                                        children: "dB"
                                    }) ]
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 28,
                                        color: (0, P.getSignalColor)(x, "sinr"),
                                        fontWeight: "bold"
                                    },
                                    children: cellularAvailability.available && d ? x : "-"
                                }) ]
                            }), (0, o.jsx)("div", {
                                style: {
                                    marginBottom: 4,
                                    height: 36,
                                    width: "100%",
                                    minHeight: 36,
                                    position: "relative"
                                },
                                children: cellularAvailability.available && d ? (0, o.jsx)(E.Tiny.Area, {
                                    ...Y(V, (0, P.getSignalColor)(x, "sinr"), x, "sinr")
                                }) : null
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-tertiary)"
                                },
                                children: "信噪比"
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        sm: 12,
                        md: 12,
                        lg: 6,
                        style: {
                            display: "flex"
                        },
                        children: (0, o.jsxs)(u.default, {
                            size: "small",
                            style: {
                                background: "var(--ant-color-bg-container)",
                                border: "1px solid var(--ant-color-border-secondary)",
                                borderRadius: 4,
                                width: "100%",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column"
                            },
                            styles: {
                                body: {
                                    padding: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    flex: 1,
                                    minHeight: 0
                                }
                            },
                            children: [ (0, o.jsxs)("div", {
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 4
                                },
                                children: [ (0, o.jsxs)("div", {
                                    style: {
                                        marginBottom: 2
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "var(--ant-color-text-secondary)",
                                            marginBottom: 0,
                                            fontWeight: 600
                                        },
                                        children: "RSRQ"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 12,
                                            color: "var(--ant-color-text-tertiary)"
                                        },
                                        children: "dB"
                                    }) ]
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 28,
                                        color: (0, P.getSignalColor)(S, "rsrq"),
                                        fontWeight: "bold"
                                    },
                                    children: cellularAvailability.available && d ? S : "-"
                                }) ]
                            }), (0, o.jsx)("div", {
                                style: {
                                    marginBottom: 4,
                                    height: 36,
                                    width: "100%",
                                    minHeight: 36,
                                    position: "relative"
                                },
                                children: cellularAvailability.available && d ? (0, o.jsx)(E.Tiny.Area, {
                                    ...Y(X, (0, P.getSignalColor)(S, "rsrq"), S, "rsrq")
                                }) : null
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 12,
                                    color: "var(--ant-color-text-tertiary)"
                                },
                                children: "参考信号接收质量"
                            }) ]
                        })
                    }) ]
                })
            });
        })), eA = (0, G.forwardRef)((function({cellularAvailability: cellularAvailability}, t) {
            let {ip: r, port: n} = (0, w.useWebSocketConfig)(), [i, a] = (0, G.useState)(!0), [l, d] = (0, 
            G.useState)(null), {message: s} = v.default.useApp(), c = async () => {
                if (!cellularAvailability.available) return d(null);
                a(!0);
                try {
                    await (0, Q.ensureGroupReady)(r, n);
                    let e = await (0, Q.getCurrentGroupAsync)(r, n), t = await (0, Q.safeSendAT)((0, 
                    N.getQENGServingCellCmd)(e));
                    d((0, N.parseQENGServingCell)(t, e));
                } catch (e) {
                    s.error("网络参数查询失败: " + e);
                }
                a(!1);
            };
            (0, G.useImperativeHandle)(t, (() => ({
                refresh: c
            })), [ r, n, cellularAvailability.available ]), (0, G.useEffect)((() => {
                cellularAvailability.available || d(null);
            }), [ cellularAvailability.available ]), (0, G.useEffect)((() => {
                let e = !1, t = () => {
                    e || c();
                };
                return _.default.getStatus && "open" === _.default.getStatus() ? t() : _.default.addOnOpenCallback(t), 
                () => {
                    e = !0, _.default.removeOnOpenCallback(t);
                };
            }), [ r, n, cellularAvailability.available ]);
            let p = l || {};
            return (0, o.jsx)(u.default, {
                style: {
                    background: em.colors.bgSecondary
                },
                title: (0, o.jsx)("div", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: (0, o.jsx)("span", {
                        style: {
                            fontSize: 14,
                            marginRight: 12
                        },
                        children: "网络参数"
                    })
                }),
                className: "my-inline-card",
                children: (0, o.jsxs)("div", {
                    style: {
                        fontSize: 16,
                        color: "var(--ant-color-text)",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        rowGap: 6,
                        columnGap: 12,
                        alignItems: "center",
                        padding: 0
                    },
                    children: [ (0, o.jsxs)("div", {
                        children: [ (0, o.jsx)("div", {
                            style: {
                                color: "var(--ant-color-text-secondary)",
                                fontSize: 12
                            },
                            children: "PCI"
                        }), (0, o.jsx)("div", {
                            style: {
                                fontWeight: "bold",
                                color: "var(--ant-cyan-7)"
                            },
                            children: p.pci ?? "-"
                        }) ]
                    }), (0, o.jsxs)("div", {
                        children: [ (0, o.jsx)("div", {
                            style: {
                                color: "var(--ant-color-text-secondary)",
                                fontSize: 12
                            },
                            children: "频点"
                        }), (0, o.jsx)("div", {
                            style: {
                                fontWeight: "bold",
                                color: "var(--ant-cyan-7)"
                            },
                            children: p.earfcn ?? "-"
                        }) ]
                    }), (0, o.jsxs)("div", {
                        children: [ (0, o.jsx)("div", {
                            style: {
                                color: "var(--ant-color-text-secondary)",
                                fontSize: 12
                            },
                            children: "MCC-MNC"
                        }), (0, o.jsxs)("div", {
                            style: {
                                fontWeight: "bold",
                                color: "var(--ant-cyan-7)"
                            },
                            children: [ p.mcc ?? "-", p.mnc ? "-" + p.mnc : "" ]
                        }) ]
                    }), (0, o.jsxs)("div", {
                        children: [ (0, o.jsx)("div", {
                            style: {
                                color: "var(--ant-color-text-secondary)",
                                fontSize: 12
                            },
                            children: "LAC"
                        }), (0, o.jsx)("div", {
                            style: {
                                fontWeight: "bold",
                                color: "var(--ant-cyan-7)"
                            },
                            children: p.lac ?? "-"
                        }) ]
                    }), (0, o.jsxs)("div", {
                        style: {
                            gridColumn: "1 / span 2"
                        },
                        children: [ (0, o.jsx)("div", {
                            style: {
                                color: "var(--ant-color-text-secondary)",
                                fontSize: 12
                            },
                            children: "小区ID"
                        }), (0, o.jsx)("div", {
                            style: {
                                fontWeight: "bold",
                                color: "var(--ant-cyan-7)"
                            },
                            children: p.cellId ?? "-"
                        }) ]
                    }) ]
                })
            });
        })), eT = (0, G.forwardRef)((function({cellularAvailability: cellularAvailability}, t) {
            var r;
            let {ip: n, port: i} = (0, w.useWebSocketConfig)(), [a, d] = (0, G.useState)(!0), [c, p] = (0, 
            G.useState)(null), csiSession = (0, G.useRef)({}), carrierRefresh = (0, G.useRef)(false), {message: m} = v.default.useApp(), f = async () => {
                if (!cellularAvailability.available) return p(null);
                if (carrierRefresh.current) return;
                carrierRefresh.current = true;
                d(!0);
                try {
                    await (0, Q.ensureGroupReady)(n, i);
                    let e = await (0, Q.getCurrentGroupAsync)(n, i), t = (0, N.getQCAINFOCmd)(e), r = [];
                    for (let e of t) r.push(await (0, Q.safeSendAT)(e));
                    let aggregation = (0, N.parseQCAINFO)(r, e);
                    if (/^(Quectel|RM\d|RG\d)/.test(e)) {
                        const serving = (0, N.parseQENGServingCell)(r[0] || "", e);
                        if (csiSession.current.group !== e) csiSession.current = {group: e};
                        const samples = await queryQuectelCarrierCSI(command => (0, Q.safeSendAT)(command), csiSession.current, serving);
                        aggregation = mergeQuectelCarrierCSI(aggregation || {scc: []}, serving, samples);
                    }
                    p(aggregation);
                } catch (e) {
                    p(null);
                    m.error("载波聚合查询失败: " + e);
                } finally {
                    carrierRefresh.current = false;
                    d(!1);
                }
            };
            (0, G.useImperativeHandle)(t, (() => ({
                refresh: f
            })), [ n, i, cellularAvailability.available ]), (0, G.useEffect)((() => {
                cellularAvailability.available || p(null);
            }), [ cellularAvailability.available ]), (0, G.useEffect)((() => (_.default.getStatus && "open" === _.default.getStatus() ? f() : _.default.addOnOpenCallback(f), 
            () => {
                _.default.removeOnOpenCallback(f);
            })), [ n, i, cellularAvailability.available ]);
            let g = (e, t, r) => {
                var n, i;
                let a, l, d, s;
                if (!t) return null;
                let c = {
                    earfcn: "频点",
                    narfcn: "频点",
                    arfcn: "频点",
                    bw: "带宽",
                    dl_bw: "下行带宽",
                    ul_bw: "上行带宽",
                    dl_bandwidth: "下行带宽",
                    ul_bandwidth: "上行带宽",
                    nr_dl_bandwidth: "下行带宽",
                    nr_ul_bandwidth: "上行带宽",
                    dl_freq: "下行频率",
                    ul_freq: "上行频率",
                    cellId: "小区ID",
                    pci: "PCI",
                    band: "Band",
                    dl_mimo: "下行MIMO层数",
                    ul_mimo: "上行MIMO层数",
                    dl_modulation: "下行调制方式",
                    ul_modulation: "上行调制方式",
                    rsrp: "RSRP",
                    rsrq: "RSRQ",
                    rssi: "RSSI",
                    sinr: "SINR",
                    rssnr: "RSSNR",
                    mcc: "MCC",
                    mnc: "MNC",
                    tac: "TAC",
                    lac: "LAC",
                    scs: "SCS",
                    scell_state: "辅小区状态",
                    scell_state_text: "辅小区状态",
                    ul_configured: "UL CA配置",
                    ul_configured_text: "UL CA配置",
                    rat: "制式",
                    duplex: "双工模式",
                    cqi: "CQI",
                    dl_mcs: "下行MCS",
                    ul_mcs: "上行MCS",
                    ri: "RI",
                    pmi: "PMI",
                    csi_status: "CSI状态",
                    tx_power: "TX Power",
                    rscp: "RSCP",
                    ecio: "ECIO",
                    phych: "PHYSICAL CH",
                    sf: "SF",
                    slot: "SLOT",
                    speech_code: "Speech Code",
                    com_mod: "Com Mod"
                }, csiFields = Object.hasOwn(t, "csi_status") ? ["dl_mcs", "ul_mcs", "ri", "cqi", "pmi", "csi_status"] : [], p = Object.keys(t).filter((e => "scell_state" !== e && "pcell_state" !== e && !csiFields.includes(e) && !["dl_modulation", "ul_modulation", "byEarfcn", "infoArr"].includes(e) && void 0 !== t[e] && "" !== t[e]));
                for (p.length > 8 && p.includes("band") && (p = p.filter((e => "band" !== e))), 
                p.length > 8 && p.includes("bw") && (p = p.filter((e => "bw" !== e))), p.length > 8 && p.includes("rsrp") && (p = p.filter((e => "rsrp" !== e))), 
                p.length > 8 && p.includes("rsrq") && (p = p.filter((e => "rsrq" !== e))), p.length > 8 && p.includes("rssi") && (p = p.filter((e => "rssi" !== e))), 
                p.length > 8 && p.includes("sinr") && (p = p.filter((e => "sinr" !== e))), p.length > 8 && p.includes("cqi") && (p = p.filter((e => "cqi" !== e))), 
                p.length > 8 && p.includes("rat") && (p = p.filter((e => "rat" !== e))), p = p.slice(0, 8); p.length < 8; ) p.push("");
                if (csiFields.length) p = ["earfcn", "dl_bw", "ul_bw", "pci", "rsrp", "rsrq", "sinr", "rssi"];
                p.push(...csiFields);
                if (t.earfcn) {
                    let e = Number(t.earfcn);
                    a = (0, P.getNrBandByArfcn)(e), l = (0, P.getLteBandByEarfcn)(e);
                }
                return (0, o.jsx)(u.default, {
                    style: {
                        flex: 1,
                        boxShadow: "0px 2px 8px var(--ant-color-fill-tertiary)",
                        borderLeft: `3px solid ${r ? "var(--ant-color-primary)" : "var(--ant-color-success)"}`,
                        borderRight: "1px solid var(--ant-color-fill-secondary)",
                        borderTop: "1px solid var(--ant-color-fill-secondary)",
                        borderBottom: "1px solid var(--ant-color-fill-secondary)"
                    },
                    variant: "borderless",
                    styles: {
                        header: {
                            background: em.colors.bgSecondary
                        },
                        body: {
                            padding: 0
                        }
                    },
                    title: (0, o.jsxs)("div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%"
                        },
                        children: [ (0, o.jsxs)("div", {
                            style: {
                                display: "flex",
                                alignItems: "center"
                            },
                            children: [ (0, o.jsx)("span", {
                                style: {
                                    fontSize: 14,
                                    color: r ? "var(--ant-color-primary)" : "#00C853",
                                    marginRight: 12
                                },
                                children: e
                            }), function(e, t, r) {
                                let n = "", i = "", a = "";
                                if (e.band) {
                                    let t = String(e.band).toUpperCase();
                                    t.includes("NR") || t.includes("5G") || t.startsWith("N") ? (n = "NR", i = "var(--ant-color-success)", 
                                    a = em.colors.bgGreen) : (t.includes("LTE") || t.includes("4G") || t.startsWith("B")) && (n = "LTE", 
                                    i = "var(--ant-color-primary)", a = em.colors.bgBlue);
                                }
                                return !n && e.earfcn && (t ? (n = "NR", i = "var(--ant-color-success)", a = em.colors.bgGreen) : r && (n = "LTE", 
                                i = "var(--ant-color-primary)", a = em.colors.bgBlue)), n ? (0, o.jsx)("span", {
                                    style: {
                                        color: i,
                                        background: a,
                                        borderRadius: 4,
                                        fontSize: 12,
                                        padding: "1px 8px",
                                        marginLeft: 6
                                    },
                                    children: n
                                }) : null;
                            }(t, a, l), (n = a, i = l, d = "", s = "", t.earfcn && (n ? (d = "N" + n, s = "var(--ant-color-success)") : i && (d = "B" + i, 
                            s = "var(--ant-color-primary)")), d ? (0, o.jsx)("span", {
                                style: {
                                    color: s,
                                    border: `1px solid ${s}`,
                                    borderRadius: 4,
                                    fontSize: 12,
                                    padding: "0 6px",
                                    marginLeft: 12
                                },
                                children: d
                            }) : null) ]
                        }), !r && (t.scell_state_text || t.scell_state) && (0, o.jsxs)("div", {
                            style: {
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--ant-color-text-secondary)",
                                marginLeft: 8
                            },
                            children: [ "状态: ", t.scell_state_text || t.scell_state ]
                        }) ]
                    }),
                    className: "my-inline-card",
                    children: (0, o.jsx)("div", {
                        style: {
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "0 0px"
                        },
                        children: Array.from({
                            length: p.length
                        }).map(((e, r) => {
                            let n = p[r], i = n ? t[n] : "";
                            if ("mcc" === n && t.mcc && t.mnc) i = `${t.mcc}-${t.mnc}`; else if ("mnc" === n && t.mcc && t.mnc) return null;
                            return (0, o.jsxs)("div", {
                                style: {
                                    marginBottom: 3,
                                    marginTop: 3
                                },
                                children: [ (0, o.jsx)("div", {
                                    style: {
                                        color: "var(--ant-color-text-secondary)",
                                        fontSize: 12
                                    },
                                    children: n ? "mcc" === n && t.mcc && t.mnc ? "MCC-MNC" : c[n] || n : ""
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontWeight: 500,
                                        fontSize: 14,
                                        color: "var(--ant-cyan-7)"
                                    },
                                    children: n === "dl_mcs" || n === "ul_mcs" ? (0, o.jsxs)("span", {
                                        children: [(0, o.jsx)("span", {style: {fontSize: 18, fontWeight: 600, color: n === "dl_mcs" ? "#fa8c16" : "#52c41a"}, children: i ?? "-"}),
                                            (0, o.jsx)("span", {style: {fontSize: 12, marginLeft: 5, color: "var(--ant-color-text-secondary)"}, children: t[n === "dl_mcs" ? "dl_modulation" : "ul_modulation"] ?? "-"})]
                                    }) : i ?? "-"
                                }) ]
                            }, r);
                        }))
                    })
                });
            }, h = (() => {
                if (!c) return {
                    count: 0,
                    totalDl: 0,
                    totalUl: 0
                };
                let e = 0, t = 0, r = 0, n = (e, t, r) => {
                    let n = 0, i = 0, o = e[t] || e.bw || e.dl_bandwidth || e.nr_dl_bandwidth, a = e[r] || e.bw || e.ul_bandwidth || e.nr_ul_bandwidth;
                    if (o) {
                        let e = String(o).match(/(\d+\.?\d*)/);
                        if (e) {
                            let t = parseFloat(e[1]);
                            n = isNaN(t) ? 0 : t;
                        }
                    }
                    if (a && "-" !== a) {
                        let e = String(a).match(/(\d+\.?\d*)/);
                        if (e) {
                            let t = parseFloat(e[1]);
                            i = isNaN(t) ? 0 : t;
                        }
                    }
                    return {
                        dl: n,
                        ul: i
                    };
                };
                if (c.pcc) {
                    e++;
                    let i = n(c.pcc, "dl_bw", "ul_bw");
                    t += i.dl, r += i.ul;
                }
                return c.scc && c.scc.length > 0 && c.scc.forEach((i => {
                    e++;
                    let o = n(i, "dl_bw", "ul_bw");
                    t += o.dl, r += o.ul;
                })), {
                    count: e,
                    totalDl: t,
                    totalUl: r
                };
            })(), b = [];
            if (c && c.pcc && b.push(g("主载波", c.pcc, !0)), c && c.scc && c.scc.length > 0) for (let e = 0; e < Math.min(4, c.scc.length); e++) b.push(g(`辅载波${e + 1}`, c.scc[e], !1));
            let x = 0 === (r = b.length) ? {
                xs: 24,
                sm: 24,
                md: 24,
                lg: 24
            } : 1 === r || 2 === r ? {
                xs: 24,
                sm: 12,
                md: 12,
                lg: 12
            } : 3 === r ? {
                xs: 24,
                sm: 12,
                md: 8,
                lg: 8
            } : 4 === r ? {
                xs: 24,
                sm: 12,
                md: 6,
                lg: 6
            } : 5 === r ? {
                xs: 24,
                sm: 12,
                md: 8,
                lg: 4
            } : {
                xs: 24,
                sm: 12,
                md: 8,
                lg: 8
            };
            return (0, o.jsx)(u.default, {
                title: (0, o.jsxs)("div", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: [ (0, o.jsx)("span", {
                        style: {
                            fontSize: 14,
                            marginRight: 12
                        },
                        children: "载波聚合信息"
                    }), h.count > 0 && (0, o.jsxs)("span", {
                        style: {
                            fontSize: 14,
                            color: "var(--ant-color-primary)"
                        },
                        children: [ "(", h.count, "载波 | 总带宽: 下行", (0, P.formatNumber)(h.totalDl), "MHz/上行", 
                        [c?.pcc, ...(c?.scc || [])].filter(Boolean).some(carrier => Object.hasOwn(carrier, "csi_status") && !/^\d+(?:\.\d+)?(?:MHz)?$/.test(String(carrier.ul_bw))) ? "-" : `${(0, P.formatNumber)(h.totalUl)}MHz`, ")" ]
                    }) ]
                }),
                styles: {
                    header: {
                        background: em.colors.bgSecondary
                    }
                },
                className: "my-inline-card",
                children: (0, o.jsx)(l.default, {
                    gutter: [ 16, 16 ],
                    children: b.length > 0 ? b.map(((e, t) => (0, o.jsx)(s.default, {
                        xs: x.xs,
                        sm: x.sm,
                        md: x.md,
                        lg: x.lg,
                        children: e
                    }, t))) : (0, o.jsx)(s.default, {
                        style: {
                            width: "100%"
                        },
                        children: (0, o.jsxs)("div", {
                            style: {
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center"
                            },
                            children: [ (0, o.jsx)("img", {
                                src: "/icons/zanwuxinxi.svg",
                                alt: "暂无信息",
                                style: {
                                    width: 128,
                                    height: 128,
                                    marginBottom: 8,
                                    marginLeft: 0,
                                    opacity: .6
                                }
                            }), (0, o.jsx)("div", {
                                style: {
                                    fontSize: 14,
                                    color: "var(--ant-color-text-secondary)"
                                },
                                children: "暂无载波聚合数据"
                            }) ]
                        })
                    })
                })
            });
        }));
        function ey({lastStartTime: e, initUp: t, initDown: r, cellularAvailability: cellularAvailability}) {
            let {ip: n, port: i, swapTrafficStats: a} = (0, w.useWebSocketConfig)(), {token: d} = T.default.useToken(), c = "#ffffff" !== d.colorBgContainer, [p, f] = (0, 
            G.useState)(!1), [v, g] = (0, G.useState)(null), [h, b] = (0, G.useState)(!1), [x, C] = (0, 
            G.useState)(5), [A, y] = (0, G.useState)(!1), [M, R] = (0, G.useState)(!0), j = (0, 
            G.useRef)(null), [E, z] = (0, G.useState)(e || 0), [D, I] = (0, G.useState)(t || 0), [O, L] = (0, 
            G.useState)(r || 0), W = async (e = !1) => {
                if (!cellularAvailability.available) return g(null), void (e && f(!1));
                e && f(!0);
                try {
                    await (0, Q.ensureGroupReady)(n, i);
                    let e = await (0, Q.getCurrentGroupAsync)(n, i), t = (0, N.getTrafficStatCmds)(e), r = [];
                    for (let e of t) r.push(await (0, Q.safeSendAT)(e));
                    let o = (0, N.parseTrafficStat)(r, e, a);
                    g(o);
                } catch {}
                e && f(!1), R(!1);
            };
            (0, G.useEffect)((() => {
                cellularAvailability.available || g(null);
            }), [ cellularAvailability.available ]);
            (0, G.useEffect)((() => {
                if (!h) {
                    j.current && clearInterval(j.current);
                    return;
                }
                return j.current = setInterval((() => W(!1)), 1e3 * x), () => {
                    j.current && clearInterval(j.current);
                };
            }), [ h, x, n, i, cellularAvailability.available ]), (0, G.useEffect)((() => (_.default.getStatus && "open" === _.default.getStatus() ? W(!0) : _.default.addOnOpenCallback((() => W(!0))), 
            () => {})), [ n, i, cellularAvailability.available ]);
            let H = async () => {
                f(!0);
                try {
                    await (0, Q.ensureGroupReady)(n, i);
                    let e = await (0, Q.getCurrentGroupAsync)(n, i);
                    for (let t of (0, N.resetTrafficStatCmds)(e)) await (0, Q.safeSendAT)(t);
                    z(0), I(0), L(0), W(!0);
                } catch {}
                f(!1);
            };
            function $(e) {
                if (null == e || isNaN(e)) return "-";
                if (A) {
                    let t = Math.floor(e / 86400), r = Math.floor(e % 86400 / 3600), n = Math.floor(e % 3600 / 60);
                    return `${t}天${r}时${n}分${e % 60}秒`;
                }
                {
                    let t = Math.floor(e / 3600), r = Math.floor(e % 3600 / 60);
                    return `${t}时${r}分${e % 60}秒`;
                }
            }
            let B = "-", F = 0, K = "-", V = "-", X = "-";
            if ((null == v ? void 0 : v.lastConnectTime) && (null == v ? void 0 : v.nowTime)) {
                let e = (0, P.formatTime)(v.lastConnectTime), t = (0, P.formatTime)(v.nowTime);
                e && t && (B = $(F = Math.max(0, Math.floor((t.getTime() - e.getTime()) / 1e3))));
            }
            if (void 0 !== F && 0 !== F) {
                if (0 !== E) {
                    let e = F - E;
                    K = $(e > 0 ? e : 0);
                } else K = $(F);
            }
            (null == v ? void 0 : v.up) !== void 0 && (V = 0 !== D ? (0, P.formatBytes)(v.up - D >= 0 ? v.up - D : 0) : (0, 
            P.formatBytes)(v.up)), (null == v ? void 0 : v.down) !== void 0 && (X = 0 !== O ? (0, 
            P.formatBytes)(v.down - O >= 0 ? v.down - O : 0) : (0, P.formatBytes)(v.down));
            let Z = {
                borderRadius: 6,
                padding: "0 18px",
                height: 32,
                fontSize: 14,
                fontWeight: 500,
                marginLeft: 8
            };
            return (0, o.jsxs)(u.default, {
                className: "my-card",
                style: {
                    background: "var(--ant-color-bg-container)",
                    boxShadow: "0 2px 8px var(--ant-color-fill-tertiary)"
                },
                title: (0, o.jsxs)("span", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: [ (0, o.jsx)("span", {
                        style: {
                            fontWeight: "bold",
                            fontSize: 16
                        },
                        children: "流量统计"
                    }), null ]
                }),
                extra: h ? (0, o.jsxs)("button", {
                    className: "my-btn",
                    style: {
                        display: "inline-flex",
                        alignItems: "center",
                        border: "1px solid var(--ant-color-primary)",
                        borderRadius: 6,
                        padding: "0 12px",
                        height: 32,
                        background: "var(--ant-color-info-bg)",
                        boxSizing: "border-box",
                        userSelect: "none",
                        color: "var(--ant-color-primary)",
                        fontWeight: 500,
                        fontSize: 14,
                        outline: "none",
                        transition: "background 0.2s, border 0.2s"
                    },
                    type: "button",
                    children: [ (0, o.jsx)("span", {
                        style: {
                            marginRight: 0,
                            cursor: "pointer"
                        },
                        onClick: e => {
                            e.stopPropagation(), b(!1);
                        },
                        children: "自动刷新"
                    }), (0, o.jsx)(S.default, {
                        min: 2,
                        max: 60,
                        value: x,
                        onChange: e => C(Number(e) || 5),
                        onKeyDown: e => {
                            [ "ArrowUp", "ArrowDown", "Tab", "Shift", "Control", "Alt" ].includes(e.key) || e.preventDefault();
                        },
                        style: {
                            width: 52,
                            height: "100%",
                            border: "none",
                            background: "transparent",
                            color: "var(--ant-color-primary)",
                            fontSize: 14,
                            textAlign: "left",
                            margin: "0px",
                            outline: "none",
                            boxShadow: "none",
                            lineHeight: "24px",
                            padding: 0
                        },
                        className: "transparent-input-number"
                    }), (0, o.jsx)("span", {
                        style: {
                            marginLeft: 2,
                            lineHeight: "24px"
                        },
                        onClick: e => {
                            e.stopPropagation(), b(!1);
                        },
                        children: "秒"
                    }) ]
                }) : (0, o.jsx)(m.default, {
                    className: "my-btn",
                    type: "default",
                    style: {
                        borderRadius: 6,
                        padding: "0 18px",
                        height: 32,
                        fontSize: 14,
                        fontWeight: 500,
                        marginLeft: 8,
                        borderColor: "var(--ant-color-primary)",
                        color: "var(--ant-color-primary)",
                        background: "var(--ant-color-bg-container)"
                    },
                    onClick: () => b(!0),
                    children: "自动刷新"
                }),
                loading: p && M,
                children: [ (0, o.jsx)(u.default, {
                    className: "my-inline-card",
                    title: (0, o.jsx)("div", {
                        style: {
                            fontSize: 14
                        },
                        children: "最后一次连接"
                    }),
                    style: {
                        background: em.colors.bgSecondary,
                        marginBottom: 24,
                        boxShadow: "none",
                        border: "none"
                    },
                    children: (0, o.jsxs)(l.default, {
                        gutter: [ 12, 12 ],
                        style: {
                            padding: "0px"
                        },
                        children: [ (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 8,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: c ? "linear-gradient(135deg, #4c5fd5 0%, #5a3f8c 100%)" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    borderRadius: 4,
                                    padding: "12px",
                                    minHeight: "80px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                                },
                                children: [ (0, o.jsx)(k, {
                                    style: {
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        fontSize: 56,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: "clamp(11px,2vw,24px)",
                                            fontWeight: "bold",
                                            color: "#fff",
                                            whiteSpace: "nowrap",
                                            width: "100%",
                                            paddingRight: 52,
                                            boxSizing: "border-box",
                                            marginTop: 4,
                                            marginBottom: 4
                                        },
                                        children: K
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "连接时长"
                                    }) ]
                                }) ]
                            })
                        }), (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 8,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: c ? "linear-gradient(135deg, #c41d7f 0%, #c7354f 100%)" : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                                    borderRadius: 4,
                                    padding: "12px",
                                    minHeight: "80px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(245, 87, 108, 0.2)"
                                },
                                children: [ (0, o.jsx)(q, {
                                    style: {
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        fontSize: 56,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: "clamp(11px,2vw,24px)",
                                            fontWeight: "bold",
                                            color: "#fff",
                                            whiteSpace: "nowrap",
                                            width: "100%",
                                            paddingRight: 52,
                                            boxSizing: "border-box",
                                            marginTop: 4,
                                            marginBottom: 4
                                        },
                                        children: V
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "上传流量"
                                    }) ]
                                }) ]
                            })
                        }), (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 8,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: c ? "linear-gradient(135deg, #096dd9 0%, #08979c 100%)" : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                                    borderRadius: 4,
                                    padding: "12px",
                                    minHeight: "80px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(79, 172, 254, 0.2)"
                                },
                                children: [ (0, o.jsx)(U, {
                                    style: {
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        fontSize: 56,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: "clamp(11px,2vw,24px)",
                                            fontWeight: "bold",
                                            color: "#fff",
                                            whiteSpace: "nowrap",
                                            width: "100%",
                                            paddingRight: 52,
                                            boxSizing: "border-box",
                                            marginTop: 4,
                                            marginBottom: 4
                                        },
                                        children: X
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "下载流量"
                                    }) ]
                                }) ]
                            })
                        }) ]
                    })
                }), (0, o.jsx)(u.default, {
                    className: "my-inline-card",
                    title: (0, o.jsx)("div", {
                        style: {
                            fontSize: 14
                        },
                        children: "累计统计"
                    }),
                    style: {
                        background: em.colors.bgSecondary,
                        marginBottom: 0,
                        boxShadow: "none",
                        border: "none"
                    },
                    children: (0, o.jsxs)(l.default, {
                        gutter: [ 12, 12 ],
                        style: {
                            padding: "0px"
                        },
                        children: [ (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 8,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: c ? "linear-gradient(135deg, #c41d7f 0%, #d48806 100%)" : "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                                    borderRadius: 4,
                                    padding: "12px",
                                    minHeight: "80px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(250, 112, 154, 0.2)"
                                },
                                children: [ (0, o.jsx)(k, {
                                    style: {
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        fontSize: 56,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: "clamp(11px,2vw,24px)",
                                            fontWeight: "bold",
                                            color: "#fff",
                                            whiteSpace: "nowrap",
                                            width: "100%",
                                            paddingRight: 52,
                                            boxSizing: "border-box",
                                            marginTop: 4,
                                            marginBottom: 4
                                        },
                                        children: B
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "总连接时长"
                                    }) ]
                                }) ]
                            })
                        }), (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 8,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: c ? "linear-gradient(135deg, #08979c 0%, #2f54eb 100%)" : "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
                                    borderRadius: 4,
                                    padding: "12px",
                                    minHeight: "80px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(48, 207, 208, 0.2)"
                                },
                                children: [ (0, o.jsx)(q, {
                                    style: {
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        fontSize: 56,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: "clamp(11px,2vw,24px)",
                                            fontWeight: "bold",
                                            color: "#fff",
                                            whiteSpace: "nowrap",
                                            width: "100%",
                                            paddingRight: 52,
                                            boxSizing: "border-box",
                                            marginTop: 4,
                                            marginBottom: 4
                                        },
                                        children: cellularAvailability.available ? (0, P.formatBytes)((null == v ? void 0 : v.up) || 0) : "-"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "总上传流量"
                                    }) ]
                                }) ]
                            })
                        }), (0, o.jsx)(s.default, {
                            xs: 24,
                            md: 8,
                            children: (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    background: c ? "linear-gradient(135deg, #4c5fd5 0%, #5a3f8c 100%)" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    borderRadius: 4,
                                    padding: "12px",
                                    minHeight: "80px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                                },
                                children: [ (0, o.jsx)(U, {
                                    style: {
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        fontSize: 56,
                                        color: "rgba(255, 255, 255, 0.2)",
                                        zIndex: 0
                                    }
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        position: "relative",
                                        zIndex: 1
                                    },
                                    children: [ (0, o.jsx)("div", {
                                        style: {
                                            fontSize: "clamp(11px,2vw,24px)",
                                            fontWeight: "bold",
                                            color: "#fff",
                                            whiteSpace: "nowrap",
                                            width: "100%",
                                            paddingRight: 52,
                                            boxSizing: "border-box",
                                            marginTop: 4,
                                            marginBottom: 4
                                        },
                                        children: cellularAvailability.available ? (0, P.formatBytes)((null == v ? void 0 : v.down) || 0) : "-"
                                    }), (0, o.jsx)("div", {
                                        style: {
                                            fontSize: 14,
                                            color: "rgba(255, 255, 255, 0.9)"
                                        },
                                        children: "总下载流量"
                                    }) ]
                                }) ]
                            })
                        }) ]
                    })
                }), (0, o.jsxs)("div", {
                    style: {
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 24
                    },
                    children: [ (0, o.jsx)(m.default, {
                        className: "my-btn",
                        type: A ? "primary" : "default",
                        style: {
                            ...Z
                        },
                        onClick: () => y((e => !e)),
                        children: A ? "显示时分秒" : "显示天数"
                    }), (0, o.jsx)(m.default, {
                        className: "my-btn",
                        danger: !0,
                        style: {
                            ...Z,
                            borderColor: "var(--ant-color-error)",
                            color: "var(--ant-color-error)"
                        },
                        onClick: H,
                        children: "清 零"
                    }) ]
                }) ]
            });
        }
        function eM() {
            let {ip: e, port: t} = (0, w.useWebSocketConfig)(), [r, n] = (0, G.useState)(!1), [i, a] = (0, 
            G.useState)(!0), [d, c] = (0, G.useState)([]), [p, f] = (0, G.useState)(!1), [v, g] = (0, 
            G.useState)(5), h = (0, G.useRef)(null), b = async (r = !1) => {
                r && n(!0);
                try {
                    await (0, Q.ensureGroupReady)(e, t);
                    let r = await (0, Q.getCurrentGroupAsync)(e, t), n = (0, N.getTempCmds)(r), i = [];
                    for (let e of n) i.push(await (0, Q.safeSendAT)(e));
                    c((0, N.parseTemp)(i, r));
                } catch {}
                r && n(!1), a(!1);
            };
            (0, G.useEffect)((() => {
                if (!p) {
                    h.current && clearInterval(h.current);
                    return;
                }
                return h.current = setInterval((() => b(!1)), 1e3 * v), () => {
                    h.current && clearInterval(h.current);
                };
            }), [ p, v, e, t ]), (0, G.useEffect)((() => (_.default.getStatus && "open" === _.default.getStatus() ? b(!0) : _.default.addOnOpenCallback((() => b(!0))), 
            () => {
                _.default.removeOnOpenCallback((() => b(!0)));
            })), [ e, t ]);
            let x = d.filter((e => e.value > 0 && e.value < 150));
            return (0, o.jsx)(u.default, {
                className: "my-card",
                style: {
                    background: "var(--ant-color-bg-container)",
                    boxShadow: "0 2px 8px var(--ant-color-fill-tertiary)"
                },
                title: (0, o.jsxs)("span", {
                    style: {
                        display: "flex",
                        alignItems: "center"
                    },
                    children: [ (0, o.jsx)("span", {
                        style: {
                            fontWeight: "bold",
                            fontSize: 16
                        },
                        children: "模组温度监控"
                    }), null ]
                }),
                extra: p ? (0, o.jsxs)("button", {
                    className: "my-btn",
                    style: {
                        display: "inline-flex",
                        alignItems: "center",
                        border: "1px solid var(--ant-color-primary)",
                        borderRadius: 6,
                        padding: "0 12px",
                        height: 32,
                        background: "var(--ant-color-info-bg)",
                        boxSizing: "border-box",
                        userSelect: "none",
                        color: "var(--ant-color-primary)",
                        fontWeight: 500,
                        fontSize: 14,
                        outline: "none",
                        transition: "background 0.2s, border 0.2s"
                    },
                    type: "button",
                    children: [ (0, o.jsx)("span", {
                        style: {
                            marginRight: 0,
                            cursor: "pointer"
                        },
                        onClick: e => {
                            e.stopPropagation(), f(!1);
                        },
                        children: "自动刷新"
                    }), (0, o.jsx)(S.default, {
                        min: 2,
                        max: 60,
                        value: v,
                        onChange: e => g(Number(e) || 5),
                        onKeyDown: e => {
                            [ "ArrowUp", "ArrowDown", "Tab", "Shift", "Control", "Alt" ].includes(e.key) || e.preventDefault();
                        },
                        style: {
                            width: 52,
                            height: "100%",
                            border: "none",
                            background: "transparent",
                            color: "var(--ant-color-primary)",
                            fontSize: 14,
                            textAlign: "left",
                            margin: "0px",
                            outline: "none",
                            boxShadow: "none",
                            lineHeight: "24px",
                            padding: 0
                        },
                        className: "transparent-input-number"
                    }), (0, o.jsx)("span", {
                        style: {
                            marginLeft: 2,
                            lineHeight: "24px"
                        },
                        onClick: e => {
                            e.stopPropagation(), f(!1);
                        },
                        children: "秒"
                    }) ]
                }) : (0, o.jsx)(m.default, {
                    className: "my-btn",
                    type: "default",
                    style: {
                        borderRadius: 6,
                        padding: "0 18px",
                        height: 32,
                        fontSize: 14,
                        fontWeight: 500,
                        marginLeft: 8,
                        borderColor: "var(--ant-color-primary)",
                        color: "var(--ant-color-primary)",
                        background: "var(--ant-color-bg-container)"
                    },
                    onClick: () => f(!0),
                    children: "自动刷新"
                }),
                loading: r && i,
                children: (0, o.jsx)(l.default, {
                    gutter: [ 16, 16 ],
                    children: 0 === x.length ? (0, o.jsxs)("div", {
                        style: {
                            gridColumn: "1 / -1",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "100%",
                            padding: "0px 0"
                        },
                        children: [ (0, o.jsx)("img", {
                            src: "/icons/zanwuxinxi.svg",
                            alt: "暂无温度数据",
                            style: {
                                width: 128,
                                height: 128,
                                marginBottom: 8,
                                opacity: .6
                            }
                        }), (0, o.jsx)("div", {
                            style: {
                                fontSize: 14,
                                color: "var(--ant-color-text-secondary)"
                            },
                            children: "暂无温度数据"
                        }) ]
                    }) : x.map(((e, t) => {
                        let r = "var(--ant-color-success)";
                        return e.value > 75 ? r = "var(--ant-color-error)" : e.value > 55 && (r = "var(--ant-color-warning)"), 
                        (0, o.jsx)(s.default, {
                            xs: 24,
                            sm: 12,
                            md: 8,
                            lg: 6,
                            xl: 6,
                            children: (0, o.jsxs)(u.default, {
                                className: "my-inline-card",
                                style: {
                                    borderRadius: 4,
                                    boxShadow: "0px 2px 8px var(--ant-color-fill-secondary)",
                                    marginBottom: 0,
                                    border: "1px solid var(--ant-color-fill-secondary)",
                                    minHeight: 12
                                },
                                styles: {
                                    body: {
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-start",
                                        justifyContent: "center",
                                        padding: 0
                                    }
                                },
                                children: [ (0, o.jsxs)("div", {
                                    style: {
                                        color: "var(--ant-color-text-secondary)",
                                        fontSize: 14,
                                        marginBottom: 2,
                                        marginLeft: 6
                                    },
                                    children: [ e.name, (0, o.jsxs)("span", {
                                        style: {
                                            color: "var(--ant-color-text-secondary)",
                                            fontSize: 12,
                                            marginLeft: 0
                                        },
                                        children: [ "（", e.description, "）" ]
                                    }) ]
                                }), (0, o.jsxs)("div", {
                                    style: {
                                        fontSize: 28,
                                        color: r,
                                        fontWeight: 500,
                                        alignSelf: "center"
                                    },
                                    children: [ e.value, (0, o.jsx)("span", {
                                        style: {
                                            fontSize: 18,
                                            color: "var(--ant-color-text-secondary)",
                                            marginLeft: 4
                                        },
                                        children: "℃"
                                    }) ]
                                }) ]
                            })
                        }, e.name + t);
                    }))
                })
            });
        }
        function eN({cellularAvailability: cellularAvailability}) {
            let {ip: e, port: t} = (0, w.useWebSocketConfig)(), {token: r} = T.default.useToken(), n = "#ffffff" !== r.colorBgContainer, [i, a] = (0, 
            G.useState)(!1), [d, c] = (0, G.useState)(void 0), [p, f] = (0, G.useState)(void 0), [g, h] = (0, 
            G.useState)(void 0), [b, x] = (0, G.useState)(void 0), {message: C} = v.default.useApp(), S = async (r = !1) => {
                r && a(!0);
                try {
                    await (0, Q.ensureGroupReady)(e, t);
                    let r = await (0, Q.getCurrentGroupAsync)(e, t), a = (0, N.getVoltageCmd)(r), u = await (0, 
                    Q.safeSendAT)(a);
                    if (x((0, N.parseVoltage)(u, r)), !cellularAvailability.available) return c(void 0), 
                    f(void 0), void h(void 0);
                    let n = (0, N.getIccidCmd)(r), i = (0, N.getImsiCmd)(r), o = (0, N.getSimNumCmd)(r), l = await (0, 
                    Q.safeSendAT)(n), d = await (0, Q.safeSendAT)(i), s = await (0, Q.safeSendAT)(o);
                    c((0, N.parseIccid)(l, r)), f((0, N.parseImsi)(d, r)), h((0, N.parseSimNum)(s, r));
                } catch (e) {
                    C.error("获取系统信息失败: " + e);
                } finally {
                    r && a(!1);
                }
            };
            return (0, G.useEffect)((() => {
                cellularAvailability.available || (c(void 0), f(void 0), h(void 0));
            }), [ cellularAvailability.available ]), (0, G.useEffect)((() => (_.default.getStatus && "open" === _.default.getStatus() ? S(!0) : _.default.addOnOpenCallback((() => S(!0))), 
            () => {
                _.default.removeOnOpenCallback((() => S(!0)));
            })), [ e, t, cellularAvailability.available ]), (0, o.jsx)(u.default, {
                title: "基本信息",
                extra: (0, o.jsx)(m.default, {
                    className: "my-btn",
                    size: "small",
                    loading: i,
                    onClick: () => S(!0),
                    icon: (0, o.jsx)(D.default, {}),
                    children: "刷新"
                }),
                className: "my-card",
                children: (0, o.jsxs)(l.default, {
                    gutter: [ 16, 16 ],
                    children: [ (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                position: "relative",
                                background: n ? "linear-gradient(135deg, #4c5fd5 0%, #5a3f8c 100%)" : "linear-gradient(135deg,rgb(86, 117, 255) 0%, #764ba2 100%)",
                                borderRadius: 4,
                                padding: "12px",
                                minHeight: "80px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                overflow: "hidden",
                                boxShadow: "0 2px 8px rgba(102, 126, 234, 0.2)"
                            },
                            children: [ (0, o.jsx)(er, {
                                style: {
                                    position: "absolute",
                                    top: 10,
                                    right: 10,
                                    fontSize: 56,
                                    color: "rgba(255, 255, 255, 0.2)",
                                    zIndex: 0
                                }
                            }), (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    zIndex: 1
                                },
                                children: [ (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 18,
                                        fontWeight: "bold",
                                        color: "#fff",
                                        marginTop: 2,
                                        marginBottom: 4
                                    },
                                    children: g || "-"
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 14,
                                        color: "rgba(255, 255, 255, 0.9)"
                                    },
                                    children: "SIM卡号码"
                                }) ]
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                position: "relative",
                                background: n ? "linear-gradient(135deg, #c41d7f 0%, #c7354f 100%)" : "linear-gradient(135deg,rgb(237, 91, 253) 0%, #f5576c 100%)",
                                borderRadius: 4,
                                padding: "12px",
                                minHeight: "80px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                overflow: "hidden",
                                boxShadow: "0 2px 8px rgba(245, 87, 108, 0.2)"
                            },
                            children: [ (0, o.jsx)(eo, {
                                style: {
                                    position: "absolute",
                                    top: 10,
                                    right: 10,
                                    fontSize: 56,
                                    color: "rgba(255, 255, 255, 0.2)",
                                    zIndex: 0
                                }
                            }), (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    zIndex: 1
                                },
                                children: [ (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 18,
                                        fontWeight: "bold",
                                        color: "#fff",
                                        marginTop: 2,
                                        marginBottom: 4
                                    },
                                    children: p || "-"
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 14,
                                        color: "rgba(255, 255, 255, 0.9)"
                                    },
                                    children: "国际移动用户识别码"
                                }) ]
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                position: "relative",
                                background: n ? "linear-gradient(135deg, #096dd9 0%, #08979c 100%)" : "linear-gradient(135deg,rgb(50, 159, 255) 0%, #00f2fe 100%)",
                                borderRadius: 4,
                                padding: "12px",
                                minHeight: "80px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                overflow: "hidden",
                                boxShadow: "0 2px 8px rgba(79, 172, 254, 0.2)"
                            },
                            children: [ (0, o.jsx)(ed, {
                                style: {
                                    position: "absolute",
                                    top: 10,
                                    right: 10,
                                    fontSize: 56,
                                    color: "rgba(255, 255, 255, 0.2)",
                                    zIndex: 0
                                }
                            }), (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    zIndex: 1
                                },
                                children: [ (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 18,
                                        fontWeight: "bold",
                                        color: "#fff",
                                        marginTop: 2,
                                        marginBottom: 4
                                    },
                                    children: d || "-"
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 14,
                                        color: "rgba(255, 255, 255, 0.9)"
                                    },
                                    children: "集成电路卡识别码"
                                }) ]
                            }) ]
                        })
                    }), (0, o.jsx)(s.default, {
                        xs: 24,
                        md: 6,
                        children: (0, o.jsxs)("div", {
                            style: {
                                position: "relative",
                                background: n ? "linear-gradient(135deg, #c41d7f 0%, #d48806 100%)" : "linear-gradient(135deg,rgb(252, 70, 124) 0%, #fee140 100%)",
                                borderRadius: 4,
                                padding: "12px",
                                minHeight: "80px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                overflow: "hidden",
                                boxShadow: "0 2px 8px rgba(250, 112, 154, 0.2)"
                            },
                            children: [ (0, o.jsx)(ec.default, {
                                style: {
                                    position: "absolute",
                                    top: 10,
                                    right: 10,
                                    fontSize: 56,
                                    color: "rgba(255, 255, 255, 0.2)",
                                    zIndex: 0
                                }
                            }), (0, o.jsxs)("div", {
                                style: {
                                    position: "relative",
                                    zIndex: 1
                                },
                                children: [ (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 18,
                                        fontWeight: "bold",
                                        color: "#fff",
                                        marginTop: 2,
                                        marginBottom: 4
                                    },
                                    children: b ? `${b} V` : "-"
                                }), (0, o.jsx)("div", {
                                    style: {
                                        fontSize: 14,
                                        color: "rgba(255, 255, 255, 0.9)"
                                    },
                                    children: "模组电压"
                                }) ]
                            }) ]
                        })
                    }) ]
                })
            });
        }
    }
} ]);
