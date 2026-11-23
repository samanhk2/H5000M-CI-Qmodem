/* 3GPP TS 38.104, downlink band candidates from measured NR-ARFCN. */
(() => {
    'use strict';
    const ranges = [
        [1, 422000, 434000], [2, 386000, 398000], [3, 361000, 376000],
        [5, 173800, 178800], [7, 524000, 538000], [8, 185000, 192000],
        [12, 145800, 149200], [13, 149200, 151200], [14, 151600, 153600],
        [18, 172000, 175000], [20, 158200, 164200], [24, 305000, 311800],
        [25, 386000, 399000], [26, 171800, 178800], [28, 151600, 160600],
        [29, 143400, 145600], [30, 470000, 472000], [34, 402000, 405000],
        [38, 514000, 524000], [39, 376000, 384000], [40, 460000, 480000],
        [41, 499200, 537999], [46, 743334, 795000], [48, 636667, 646666],
        [50, 286400, 303400], [51, 285400, 286400], [53, 496700, 499000],
        [65, 422000, 440000], [66, 422000, 440000], [67, 147600, 151600],
        [70, 399000, 404000], [71, 123400, 130400], [74, 295000, 303600],
        [75, 286400, 303400], [76, 285400, 286400], [77, 620000, 680000],
        [78, 620000, 653333], [79, 693334, 733333], [85, 145600, 149200],
        [90, 499200, 538000], [91, 285400, 286400], [92, 286400, 303400],
        [93, 285400, 286400], [94, 286400, 303400], [96, 795000, 875000],
        [100, 183880, 185000], [101, 380000, 382000], [102, 796334, 828333],
        [104, 828334, 875000], [257, 2054166, 2104165], [258, 2016667, 2070832],
        [259, 2270833, 2337499], [260, 2229166, 2279165], [261, 2070833, 2084999],
        [262, 2399166, 2415832]
    ];
    function label(arfcn, band) {
        const reported = String(band ?? '').trim().match(/^n?([1-9]\d{0,3})$/i);
        if (reported) return 'n' + reported[1];
        const number = String(arfcn ?? '').trim();
        if (!/^\d+$/.test(number)) return '未上报';
        const candidates = ranges.filter(([, start, end]) => +number >= start && +number <= end)
            .map(([value]) => 'n' + value);
        if (!candidates.length) return '未上报';
        return candidates.length === 1 ? candidates[0] + '（按频点）' : candidates.join(' / ') + '（候选）';
    }
    function reported(arfcn, pci, data) {
        if (!/^\d+$/.test(String(pci)) || !/^\d+$/.test(String(arfcn))) return undefined;
        const bands = new Set();
        for (const line of String(data).split(/\r?\n/)) {
            if (!line.trimStart().startsWith('+QENG:')) continue;
            const fields = line.trimStart().slice(6).split(',').map(field => field.trim().replace(/^"|"$/g, ''));
            const start = fields[0] === 'servingcell' ? 2 : 0;
            const profile = fields[start];
            if (profile !== 'NR5G-SA' && (profile !== 'NR5G-NSA' || start !== 0)) continue;
            const nativePCI = fields[start + (profile === 'NR5G-SA' ? 5 : 3)];
            const nativeARFCN = fields[start + 7];
            const nativeBand = fields[start + 8];
            if (/^\d+$/.test(nativePCI ?? '') && /^\d+$/.test(nativeARFCN ?? '') &&
                +nativePCI === +pci && +nativeARFCN === +arfcn && /^[1-9]\d{0,3}$/.test(nativeBand ?? '')) {
                bands.add(+nativeBand);
            }
        }
        if (bands.size === 1) return bands.values().next().value;
    }
    window.modemwebuiNRBand = Object.freeze({ label, reported });
})();
