// yupoo-extractor.mjs
async function searchYupoo(q) {
    const url = `https://huiliyuan.x.yupoo.com/search/album?uid=1&sort=&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const html = await res.text();
    
    const titles = [];
    // Match: class="album__main" \s* title="TITLE" \s* href="HREF"
    const rex = /class="album__main"[\s\S]*?title="([^"]+)"[\s\S]*?href="([^"]+)"/g;
    let m;
    while((m = rex.exec(html)) !== null) {
        titles.push({
            title: m[1],
            url: `https://huiliyuan.x.yupoo.com${m[2]}`
        });
    }
    return titles;
}

const ITEMS = [
    { query: "皇马 00", name: "Real Madrid 2000-2001 Local" },
    { query: "皇马 04", name: "Real Madrid 2004-2005 Local" },
    { query: "皇马 11", name: "Real Madrid 2011-2012 Local / Arquero" },
    { query: "皇马 17", name: "Real Madrid 2017-2018 Local" },
    { query: "AC米兰 06", name: "AC Milan 2006 Visitante" },
    { query: "AC米兰 09", name: "AC Milan 2009-2010 Local" },
    { query: "曼联 07", name: "Manchester Utd 2007-2008 Local/Visitante" },
    { query: "巴萨 06", name: "Barcelona 2006 Visitante" },
    { query: "巴萨 13", name: "Barcelona 2013-2014 Local" },
    { query: "切尔西 07", name: "Chelsea 2007-2008 Local" },
    { query: "波尔图 03", name: "Porto 2003-2004 Local" },
    { query: "罗马 17", name: "AS Roma 2017-2018 Local" },
    { query: "河床 18", name: "River Plate 2018 Local" },
    { query: "博卡 06", name: "Boca Juniors 2006-2007" },
    { query: "桑托斯 11", name: "Santos 2011 Local" },
    { query: "意大利 06", name: "Italia 2006 Local" }
];

async function run() {
    console.log("Starting Yupoo Extraction...\n");
    const foundUrls = [];
    
    for (const item of ITEMS) {
        console.log(`[🔎] Searching: ${item.name} (querying: "${item.query}")`);
        let matches = await searchYupoo(item.query);
        
        if (matches.length > 0) {
            // Take the first three to give the user options or just select the first one
            console.log(`  -> Best Match: ${matches[0].title} | ${matches[0].url}`);
            foundUrls.push(matches[0].url);
        } else {
            console.log(`  -> ❌ NOT FOUND`);
        }
        await new Promise(r => setTimeout(r, 800)); // anti rate-limit
    }
    
    console.log("\n[✅] All Found URLs (can be passed to pv-batch-import):");
    console.log(foundUrls.map(u => `"${u}"`).join(",\n"));
}

run();
