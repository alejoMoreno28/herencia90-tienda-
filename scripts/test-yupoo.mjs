// Native fetch is available in Node 18+

async function run() {
    const res = await fetch("https://huiliyuan.x.yupoo.com/search/album?uid=1&sort=&q=Real+Madrid");
    const html = await res.text();
    const match = html.match(/<a.*?href="\/albums\/.*?<\/a>/g);
    console.log(match ? match.slice(0, 3) : 'No match');
}
run();
