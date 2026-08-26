const SOURCES = [
  {
    id: "cnbc_finance",
    name: "CNBC Finance",
    type: "news",
    url: "https://www.cnbc.com/id/10000664/device/rss/rss.html"
  },
  {
    id: "cnbc_investing",
    name: "CNBC Investing",
    type: "news",
    url: "https://www.cnbc.com/id/15839069/device/rss/rss.html"
  },
  {
    id: "cnbc_markets",
    name: "CNBC Markets",
    type: "news",
    url: "https://www.cnbc.com/id/20910258/device/rss/rss.html"
  },
  {
    id: "cnbc_earnings",
    name: "CNBC Earnings",
    type: "news",
    url: "https://www.cnbc.com/id/15839135/device/rss/rss.html"
  },
  {
    id: "reddit_stocks",
    name: "Reddit Stocks",
    type: "social",
    url: "https://www.reddit.com/r/stocks/.rss"
  },
  {
    id: "reddit_investing",
    name: "Reddit Investing",
    type: "social",
    url: "https://www.reddit.com/r/investing/.rss"
  },
  {
    id: "reddit_wallstreetbets",
    name: "Reddit WallStreetBets",
    type: "social",
    url: "https://www.reddit.com/r/wallstreetbets/.rss"
  },
  {
    id: "reddit_bitcoin",
    name: "Reddit Bitcoin",
    type: "social",
    url: "https://www.reddit.com/r/Bitcoin/.rss"
  }
];

const KEYWORDS = [
  "fed",
  "federal reserve",
  "ecb",
  "bce",
  "inflation",
  "inflazione",
  "interest rate",
  "tassi",
  "recession",
  "recessione",
  "earnings",
  "revenue",
  "profit",
  "utile",
  "ricavi",
  "guidance",
  "forecast",
  "acquisition",
  "acquisizione",
  "merger",
  "fusione",
  "nasdaq",
  "s&p 500",
  "dow jones",
  "wall street",
  "stocks",
  "shares",
  "azioni",
  "bitcoin",
  "ethereum",
  "crypto",
  "oil",
  "petrolio",
  "gold",
  "oro",
  "crash",
  "rally",
  "selloff",
  "bull",
  "bear"
];

function cleanText(value) {
  if (!value) return "";

  let text = String(value);

  text = text.replaceAll("<![CDATA[", "");
  text = text.replaceAll("]]>", "");
  text = text.replaceAll("&amp;", "&");
  text = text.replaceAll("&lt;", "<");
  text = text.replaceAll("&gt;", ">");
  text = text.replaceAll("&quot;", '"');
  text = text.replaceAll("&#39;", "'");
  text = text.replaceAll("&nbsp;", " ");

  while (text.includes("<")) {
    const start = text.indexOf("<");
    const end = text.indexOf(">", start);

    if (end === -1) break;

    text =
      text.substring(0, start) +
      " " +
      text.substring(end + 1);
  }

  return text
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll("\t", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block, tag) {
  const open = "<" + tag;
  const close = "</" + tag + ">";

  const startTag = block.indexOf(open);

  if (startTag === -1) return "";

  const startContent = block.indexOf(">", startTag);

  if (startContent === -1) return "";

  const endContent =
    block.indexOf(close, startContent);

  if (endContent === -1) return "";

  return cleanText(
    block.substring(
      startContent + 1,
      endContent
    )
  );
}

function getLink(block) {
  let position = 0;

  while (true) {
    const start = block.indexOf("<link", position);

    if (start === -1) break;

    const end = block.indexOf(">", start);

    if (end === -1) break;

    const tag = block.substring(
      start,
      end + 1
    );

    const hrefIndex =
      tag.indexOf('href="');

    if (hrefIndex !== -1) {
      const valueStart =
        hrefIndex + 6;

      const valueEnd =
        tag.indexOf('"', valueStart);

      if (valueEnd !== -1) {
        return tag.substring(
          valueStart,
          valueEnd
        );
      }
    }

    position = end + 1;
  }

  const link =
    getTag(block, "link");

  return link || "";
}

function parseRSS(xml, source) {
  const items = [];

  let position = 0;

  while (true) {
    let start =
      xml.indexOf("<item", position);

    let closing =
      "</item>";

    if (start === -1) {
      start =
        xml.indexOf("<entry", position);

      closing =
        "</entry>";
    }

    if (start === -1) break;

    const end =
      xml.indexOf(closing, start);

    if (end === -1) break;

    const block =
      xml.substring(
        start,
        end + closing.length
      );

    const title =
      getTag(block, "title");

    const description =
      getTag(block, "description") ||
      getTag(block, "summary") ||
      getTag(block, "content");

    const link =
      getLink(block);

    const published =
      getTag(block, "pubDate") ||
      getTag(block, "published") ||
      getTag(block, "updated");

    if (title) {
      items.push({
        source,
        title,
        description,
        link,
        published
      });
    }

    position =
      end + closing.length;
  }

  return items;
}

async function fetchSource(source) {
  const started =
    Date.now();

  try {
    const response =
      await fetch(
        source.url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 InvestimentiBot/1.0",
            "Accept":
              "application/rss+xml, application/xml, text/xml, */*"
          }
        }
      );

    const responseTime =
      Date.now() - started;

    if (!response.ok) {
      return {
        id: source.id,
        name: source.name,
        type: source.type,
        status: "error",
        httpStatus:
          response.status,
        responseTime,
        count: 0,
        error:
          "HTTP " +
          response.status,
        items: []
      };
    }

    const xml =
      await response.text();

    const items =
      parseRSS(
        xml,
        source.name
      );

    return {
      id: source.id,
      name: source.name,
      type: source.type,
      status:
        items.length > 0
          ? "ok"
          : "empty",
      httpStatus:
        response.status,
      responseTime,
      count: items.length,
      error: null,
      items
    };

  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      status: "error",
      httpStatus: null,
      responseTime:
        Date.now() - started,
      count: 0,
      error:
        error.message ||
        "Unknown error",
      items: []
    };
  }
}

async function collectSources() {
  return Promise.all(
    SOURCES.map(
      source =>
        fetchSource(source)
    )
  );
}

function deduplicate(items) {
  const seen =
    new Set();

  const result = [];

  for (const item of items) {
    const key =
      item.link ||
      item.title.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function scoreItem(item) {
  const text = (
    item.title +
    " " +
    item.description
  ).toLowerCase();

  let score = 0;

  for (const keyword of KEYWORDS) {
    if (text.includes(keyword)) {
      score += 1;
    }
  }

  const urgent = [
    "breaking",
    "crash",
    "plunge",
    "surge",
    "rally",
    "emergency",
    "unexpected",
    "downgrade",
    "upgrade"
  ];

  for (const word of urgent) {
    if (text.includes(word)) {
      score += 2;
    }
  }

  return score;
}

function analyze(items) {
  return items
    .map(item => ({
      ...item,
      score:
        scoreItem(item)
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    );
}

function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=UTF-8",
        "access-control-allow-origin":
          "*",
        "cache-control":
          "no-store"
      }
    }
  );
}

function homeResponse() {
  return new Response(
    `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>Investimenti Bot</title>

<style>
body {
  font-family: Arial, sans-serif;
  background: #111827;
  color: white;
  padding: 25px;
  max-width: 800px;
  margin: auto;
}

.card {
  background: #1f2937;
  padding: 20px;
  margin: 15px 0;
  border-radius: 14px;
}

a {
  color: #60a5fa;
  font-size: 18px;
}
</style>
</head>

<body>

<h1>📊 Investimenti Bot</h1>

<div class="card">
<h2>🟢 Worker online</h2>
<p>Motore di raccolta dati attivo.</p>
</div>

<div class="card">

<h2>Test</h2>

<p>
<a href="/health">
❤️ Health
</a>
</p>

<p>
<a href="/status">
📡 Stato fonti
</a>
</p>

<p>
<a href="/news">
📰 News
</a>
</p>

<p>
<a href="/social">
💬 Social
</a>
</p>

<p>
<a href="/scan">
🔎 Scan completo
</a>
</p>

</div>

</body>
</html>`,
    {
      headers: {
        "content-type":
          "text/html; charset=UTF-8"
      }
    }
  );
}

async function handleRequest(
  request
) {
  const url =
    new URL(request.url);

  const path =
    url.pathname;

  if (
    request.method ===
    "OPTIONS"
  ) {
    return new Response(
      null,
      {
        headers: {
          "access-control-allow-origin":
            "*",
          "access-control-allow-methods":
            "GET, OPTIONS",
          "access-control-allow-headers":
            "Content-Type"
        }
      }
    );
  }

  if (
    path === "/" ||
    path === ""
  ) {
    return homeResponse();
  }

  if (path === "/health") {
    return jsonResponse({
      ok: true,
      bot:
        "Investimenti Bot",
      status:
        "online",
      version:
        "2.0.0",
      timestamp:
        new Date().toISOString()
    });
  }

  if (path === "/status") {
    const sources =
      await collectSources();

    return jsonResponse({
      ok: true,
      timestamp:
        new Date().toISOString(),

      sources:
        sources.map(source => ({
          id: source.id,
          name: source.name,
          type: source.type,
          status: source.status,
          httpStatus:
            source.httpStatus,
          responseTime:
            source.responseTime,
          count:
            source.count,
          error:
            source.error
        })),

      summary: {
        total:
          sources.length,

        working:
          sources.filter(
            s =>
              s.status === "ok"
          ).length,

        errors:
          sources.filter(
            s =>
              s.status === "error"
          ).length,

        empty:
          sources.filter(
            s =>
              s.status === "empty"
          ).length
      }
    });
  }

  if (path === "/news") {
    const sources =
      await collectSources();

    const items =
      sources
        .filter(
          source =>
            source.type ===
            "news"
        )
        .flatMap(
          source =>
            source.items
        );

    const unique =
      deduplicate(items);

    const analyzed =
      analyze(unique);

    return jsonResponse({
      ok: true,
      type:
        "news",

      count:
        analyzed.length,

      items:
        analyzed.slice(
          0,
          100
        ),

      sources:
        sources.map(
          source => ({
            name:
              source.name,
            status:
              source.status,
            httpStatus:
              source.httpStatus,
            count:
              source.count,
            error:
              source.error
          })
        )
    });
  }

  if (path === "/social") {
    const sources =
      await collectSources();

    const items =
      sources
        .filter(
          source =>
            source.type ===
            "social"
        )
        .flatMap(
          source =>
            source.items
        );

    const unique =
      deduplicate(items);

    const analyzed =
      analyze(unique);

    return jsonResponse({
      ok: true,
      type:
        "social",

      count:
        analyzed.length,

      items:
        analyzed.slice(
          0,
          100
        ),

      sources:
        sources.map(
          source => ({
            name:
              source.name,
            status:
              source.status,
            httpStatus:
              source.httpStatus,
            count:
              source.count,
            error:
              source.error
          })
        )
    });
  }

  if (path === "/scan") {
    const sources =
      await collectSources();

    const news =
      analyze(
        deduplicate(
          sources
            .filter(
              source =>
                source.type ===
                "news"
            )
            .flatMap(
              source =>
                source.items
            )
        )
      );

    const social =
      analyze(
        deduplicate(
          sources
            .filter(
              source =>
                source.type ===
                "social"
            )
            .flatMap(
              source =>
                source.items
            )
        )
      );

    const all =
      analyze(
        deduplicate([
          ...news,
          ...social
        ])
      );

    return jsonResponse({
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
          all.length,

        workingSources:
          sources.filter(
            source =>
              source.status ===
              "ok"
          ).length,

        failedSources:
          sources.filter(
            source =>
              source.status ===
              "error"
          ).length
      },

      top_signals:
        all.slice(
          0,
          30
        ),

      news:
        news.slice(
          0,
          50
        ),

      social:
        social.slice(
          0,
          50
        ),

      sources:
        sources.map(
          source => ({
            name:
              source.name,
            type:
              source.type,
            status:
              source.status,
            httpStatus:
              source.httpStatus,
            count:
              source.count,
            error:
              source.error
          })
        )
    });
  }

  return jsonResponse(
    {
      ok: false,
      error:
        "Endpoint non trovato",

      available: [
        "/",
        "/health",
        "/status",
        "/news",
        "/social",
        "/scan"
      ]
    },
    404
  );
}

export default {
  async fetch(
    request,
    env,
    ctx
  ) {
    return handleRequest(
      request
    );
  }
};
