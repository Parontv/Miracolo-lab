const HTML = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Miracolo Lab</title>
<style>
body{
  background:#080c11;
  color:#fff;
  font-family:Arial,sans-serif;
  padding:30px
}
a{color:#93c5fd}
</style>
</head>
<body>
<h1>🪄 Miracolo Lab</h1>
<p>Caricamento dashboard…</p>
<p><a href="/index.html">Apri dashboard</a></p>
</body>
</html>`;

function getTagValue(text, tag) {

  const re = new RegExp(
    "<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">",
    "i"
  );

  const match = text.match(re);

  if (!match) {
    return "";
  }

  return match[1]
    .replace(/<!CDATA\[|\]>/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}


function parseRSS(text, source) {

  const results = [];

  const re =
    /<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi;

  let match;

  while ((match = re.exec(text)) {

    const item = match[0];

    const title =
      getTagValue(item, "title");

    const description =
      getTagValue(item, "description");

    const date =
      getTagValue(item, "pubDate");

    let link =
      getTagValue(item, "link");

    /*
     * Alcuni feed possono avere link vuoti.
     */

    if (!link) {

      const linkMatch =
        item.match(
          /<link[^>]*>([\s\S]*?)<\/link>/i
        );

      if (linkMatch) {
        link =
          linkMatch[1]
            .replace(/<!CDATA\[|\]>/g, "")
            .trim();
      }

    }

    if (title && link) {

      results.push({

        title: title,

        description: description,

        date: date,

        link: link,

        source: source

      });

    }

  }

  return results;

}


async function fetchFeed(url) {

  const response =
    await fetch(
      url,
      {
        headers: {

          "User-Agent":
            "Miracolo-Lab-News-Radar/1.0",

          "Accept":
            "application/rss+xml,application/xml,text/xml"

        }
      }
    );

  if (!response.ok) {

    throw new Error(
      "HTTP " + response.status
    );

  }

  return await response.text();

}


function calculateScore(item) {

  const text =
    (
      (item.title || "") +
      " " +
      (item.description || "")
    ).toLowerCase();

  let score = 1;


  const keywords = [

    "nvidia",
    "nvda",
    "bitcoin",
    "btc",
    "ethereum",
    "crypto",
    "ai",
    "artificial intelligence",
    "semiconductor",
    "tsmc",
    "amd",
    "broadcom",
    "crowdstrike",
    "fed",
    "federal reserve",
    "inflation",
    "earnings",
    "guidance",
    "upgrade",
    "downgrade",
    "tariff",
    "recession",
    "gold",
    "copper",
    "oil",
    "treasury",
    "interest rate"

  ];


  keywords.forEach(
    function(keyword) {

      if (
        text.includes(keyword)
      ) {

        score += 0.35;

      }

    }
  );


  const strongWords = [

    "surge",
    "rally",
    "plunge",
    "crash",
    "record",
    "warning",
    "beat",
    "miss",
    "jumps",
    "drops"

  ];


  strongWords.forEach(
    function(word) {

      if (
        text.includes(word)
      ) {

        score += 0.7;

      }

    }
  );


  return Math.min(
    6,
    Math.round(score)
  );

}


async function fullScan() {

  const feeds = [

    {
      name: "Google News",

      url:
        "https://news.google.com/rss/search?q=stock%20market%20OR%20finance%20OR%20Federal%20Reserve%20OR%20Nvidia%20OR%20Bitcoin%20OR%20AI&hl=en-US&gl=US&ceid=US:en"

    },

    {
      name: "GDELT",

      url:
        "https://api.gdeltproject.org/api/v2/doc/doc?query=stock%20OR%20markets%20OR%20finance%20OR%20Nvidia%20OR%20Bitcoin&mode=artlist&maxrecords=30&format=rss"

    },

    {
      name: "Reddit Investing",

      url:
        "https://www.reddit.com/r/investing/.rss?limit=25"

    },

    {
      name: "Reddit Stocks",

      url:
        "https://www.reddit.com/r/stocks/.rss?limit=25"

    },

    {
      name: "Reddit WallStreetBets",

      url:
        "https://www.reddit.com/r/wallstreetbets/.rss?limit=25"

    }

  ];


  const allItems = [];

  const sources = [];


  await Promise.all(

    feeds.map(
      async function(feed) {

        try {

          const text =
            await fetchFeed(
              feed.url
            );

          const items =
            parseRSS(
              text,
              feed.name
            );


          items.forEach(
            function(item) {

              item.score =
                calculateScore(item);

            }
          );


          allItems.push(
            ...items
          );


          sources.push({

            name:
              feed.name,

            type:
              feed.name
                .toLowerCase()
                .includes("reddit")
                ?
                "social"
                :
                "news",

            status:
              "ok",

            count:
              items.length,

            error:
              null

          });


        } catch (error) {

          sources.push({

            name:
              feed.name,

            type:
              feed.name
                .toLowerCase()
                .includes("reddit")
                ?
                "social"
                :
                "news",

            status:
              "error",

            count:
              0,

            error:
              String(error)

          });

        }

      }
    )

  );


  allItems.sort(
    function(a, b) {

      return (
        Number(b.score || 0) -
        Number(a.score || 0)
      );

    }
  );


  const news =
    allItems.filter(
      function(item) {

        return !String(
          item.source
        )
        .toLowerCase()
        .includes("reddit");

      }
    );


  const social =
    allItems.filter(
      function(item) {

        return String(
          item.source
        )
        .toLowerCase()
        .includes("reddit");

      }
    );


  return {

    ok: true,

    type:
      "full_scan",

    timestamp:
      new Date().toISOString(),

    summary: {

      news:
        news.length,

      social:
        social.length,

      total:
        allItems.length,

      workingSources:
        sources.filter(
          function(s) {

            return s.status === "ok";

          }
        ).length,

      failedSources:
        sources.filter(
          function(s) {

            return s.status !== "ok";

          }
        ).length

    },

    top_signals:
      allItems.slice(0, 40),

    news:
      news.slice(0, 40),

    social:
      social.slice(0, 25),

    sources:
      sources

  };

}


export default {

  async fetch(request, env) {

    const url =
      new URL(request.url);


    /*
     * HEALTH
     */

    if (
      url.pathname === "/api/health"
    ) {

      return Response.json({

        ok: true,

        service:
          "Miracolo Lab News Radar",

        timestamp:
          new Date().toISOString()

      });

    }


    /*
     * FULL SCAN
     */

    if (
      url.pathname === "/api/full-scan"
    ) {

      try {

        const result =
          await fullScan();

        return Response.json(
          result,
          {
            headers: {
              "Cache-Control":
                "no-store, no-cache, must-revalidate"
            }
          }
        );

      } catch (error) {

        return Response.json(

          {
            ok: false,

            error:
              String(error),

            timestamp:
              new Date().toISOString()

          },

          {
            status: 500
          }

        );

      }

    }


    /*
     * COMPATIBILITÀ
     */

    if (
      url.pathname === "/api/news"
    ) {

      return Response.redirect(

        new URL(
          "/api/full-scan",
          url
        ),

        307

      );

    }


    /*
     * DASHBOARD
     */

    if (
      url.pathname === "/" ||
      url.pathname === "/index.html"
    ) {

      if (env.ASSETS) {

        const asset =
          await env.ASSETS.fetch(
            new Request(
              new URL(
                "/index.html",
                url
              )
            )
          );

        if (asset.ok) {

          return asset;

        }

      }


     
