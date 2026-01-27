import fetch from 'node-fetch';

const prod = process.env.PROD_URL || 'https://daysweeper.vercel.app';
const local = process.env.LOCAL_URL || 'http://localhost:3000';

const cases = [
  '/api/routes',
  '/api/targets?limit=5',
  '/api/targets/search?q=honda'
];

(async () => {
  for (const p of cases) {
    try {
      const [a, b] = await Promise.all([
        fetch(local + p).then((r) => ({
          ok: r.ok,
          s: r.status,
          t: r.headers.get('content-type'),
          b: r.text()
        })),
        fetch(prod + p).then((r) => ({
          ok: r.ok,
          s: r.status,
          t: r.headers.get('content-type'),
          b: r.text()
        }))
      ]);
      const la = await a.b;
      const lb = await b.b;
      console.log(`=== ${p}`);
      console.log(`LOCAL: ${a.s} ${a.t}\n${la.slice(0, 300)}\n`);
      console.log(`PROD : ${b.s} ${b.t}\n${lb.slice(0, 300)}\n`);
    } catch (error: any) {
      console.log(`=== ${p} (ERROR)`);
      console.log(`Error: ${error.message}\n`);
    }
  }
})();
