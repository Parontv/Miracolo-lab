const NEWS_FEEDS = [
  {
    name: "Mercati",
    url: "https://news.google.com/rss/search?q=borsa%20mercati%20finanza&hl=it&gl=IT&ceid=IT:it"
  },
  {
    name: "Wall Street",
    url: "https://news.google.com/rss/search?q=Wall%20Street%20azioni&hl=it&gl=IT&ceid=IT:it"
  },
  {
    name: "Bitcoin",
    url: "https://news.google.com/rss/search?q=bitcoin%20crypto&hl=it&gl=IT&ceid=IT:it"
  },
  {
    name: "Economia",
    url: "https://news.google.com/rss/search?q=inflazione%20FED%20BCE%20tassi&hl=it&gl=IT&ceid=IT:it"
  }
];

const SOCIAL_FEEDS = [
  {
    name: "Reddit Stocks",
    url: "https://www.reddit.com/r/stocks/.rss"
  },
  {
    name: "Reddit Investing",
    url: "https://www.reddit.com/r/investing/.rss"
  },
  {
    name: "Reddit WallStreetBets",
    url: "https://www.reddit.com/r/wallstreetbets/.rss"
  },
  {
    name: "Reddit Bitcoin",
    url: "https://www.reddit.com/r/Bitcoin/.rss"
  }
];

function cleanText(value) {
  if (!value) return "";

  let text = value;

  text = text.replaceAll("<![CDATA[", "");
  text = text.replaceAll("]]>", "");
  text = text.replaceAll("&amp;", "&");
  text = text.replaceAll("&lt;", "<");
  text = text.replaceAll("&gt;", ">");
  text = text.replaceAll("&quot;", '"');
  text = text.replaceAll("&#39;", "'");

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
    .trim();
}

function getTag(text, tag) {
  const open = "<" + tag;
  const close = "</" + tag + ">";

  const startTag = text.indexOf(open);

  if (startTag === -1) return "";

  const startContent = text.indexOf(">", startTag);

  if (startContent === -1) return "";

  const endContent = text.indexOf(
    close,
    startContent
  );

  if (endContent === -1) return "";

  return cleanText(
    text.substring(
      startContent + 1,
      endContent
    )
  );
}

function getLink(text) {
  const href = 'href="';
  const hrefStart = text.indexOf(href);

  if (hrefStart !== -1) {
    const start = hrefStart + href.length;
    const end = text.indexOf('"', start);

    if (end !== -1) {
      return text.substring(start, end);
    }
  }

  const linkStart = text.indexOf("<link>");

  if (linkStart !== -1) {
    const start = linkStart + 6;
    const end = text.indexOf("</link>", start);

    if (end !== -1) {
      return cleanText(
        text.substring(start, end)
      );
    }
  }

  return "";
}

function parseRSS(xml, source) {
  const results = [];

  let position = 0;

  while (true) {
    let start = xml.indexOf("<item", position);
    let endTag = "</item>";

    if (start === -1) {
      start = xml.indexOf("<entry", position);
      endTag = "</entry>";
    }

    if (start === -1) break;

    const end = xml.indexOf(
      endTag,
      start
    );

    if (end === -1) break;

    const block = xml.substring(
      start,
      end + endTag.length
    );

    const title =
      getTag(block, "title");

    const description =
      getTag(block, "description") ||
      getTag(block, "summary") ||
      getTag(block, "content");

    const link = getLink(block);

    const published =
      getTag(block, "pubDate") ||
      getTag(block, "published") ||
      getTag(block, "updated");

    if (title) {
      results.push({
        source,
        title,
        description,
        link,
        published
      });
    }

    position = end + endTag.length;
  }

  return results;
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(
      feed.url,
      {
        headers: {
          "User-Agent":
            "InvestimentiBot/1.0"
        }
      }
    );

    if (!response.ok) {
      return {
        source: feed.name,
        error:
          "HTTP " + response.status,
        items: []
      };
    }

    const text =
      await response.text();

    return {
      source: feed.name,
      error: null,
      items: parseRSS(
        text,
        feed.name
      )
    };

  } catch (error) {
    return {
      source: feed.name,
      error: error.message,
      items: []
    };
  }
}

async function collectFeeds(feeds) {
  const results =
    await Promise.all(
      feeds.map(fetchFeed)
    );

  return results;
}

function deduplicate(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key =
      item.link ||
      item.source +
      "|" +
      item.title;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function scoreItem(item) {
  const text = (
    item.title +
    " " +
    item.description
  ).toLowerCase();

  const keywords = [
    "fed",
    "bce",
    "inflazione",
    "tassi",
    "recessione",
    "earnings",
    "utile",
    "ricavi",
    "guidance",
    "acquisizione",
    "fusione",
    "bitcoin",
    "ethereum",
    "nasdaq",
    "wall street",
    "borsa",
    "crash",
    "rally"
  ];

  let score = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score++;
    }
  }

  return score;
}

function analyze(items) {
  return items
    .map(item => ({
      ...item,
      score: scoreItem(item)
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    );
}

function json(data, status = 200) {
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
          "*"
      }
    }
  );
}

function home() {
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
  font-family: Arial;
  background: #111827;
  color: white;
  padding: 25px;
}
.card {
  background: #1f2937;
  padding: 20px;
  margin: 15px 0;
  border-radius: 12px;
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
<h2>🟢 Online</h2>
<p>Il Worker è operativo.</p>
</div>

<div class="card">
<h2>Test</h2>

<p>
<a href="/health">
❤️ Health
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

async function handle(request) {
  const url =
    new URL(request.url);

  const path =
    url.pathname;

  if (request.method === "OPTIONS") {
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
    return home();
  }

  if (path === "/health") {
    return json({
      ok: true,
      bot:
        "Investimenti Bot",
      status: "online",
      version: "1.0.1",
      timestamp:
        new Date().toISOString()
    });
  }

  if (path === "/news") {
    const feeds =
      await collectFeeds(
        NEWS_FEEDS
      );

    const items =
      deduplicate(
        feeds.flatMap(
          feed => feed.items
        )
      );

    return json({
      ok: true,
      type: "news",
      count: items.length,
      items:
        analyze(items).slice(
          0,
          50
        ),
      feeds
    });
  }

  if (path === "/social") {
    const feeds =
      await collectFeeds(
        SOCIAL_FEEDS
      );

    const items =
      deduplicate(
        feeds.flatMap(
          feed => feed.items
        )
      );

    return json({
      ok: true,
      type: "social",
      count: items.length,
      items:
        analyze(items).slice(
          0,
          50
        ),
      feeds
    });
  }

  if (path === "/scan") {
    const [
      newsFeeds,
      socialFeeds
    ] = await Promise.all([
      collectFeeds(
        NEWS_FEEDS
      ),
      collectFeeds(
        SOCIAL_FEEDS
      )
    ]);

    const news =
      analyze(
        deduplicate(
          newsFeeds.flatMap(
            feed => feed.items
          )
        )
      );

    const social =
      analyze(
        deduplicate(
          socialFeeds.flatMap(
            feed => feed.items
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

    return json({
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
          all.length
      },

      top_signals:
        all.slice(0, 20),

      news:
        news.slice(0, 30),

      social:
        social.slice(0, 30)
    });
  }

  return json(
    {
      ok: false,
      error:
        "Endpoint non trovato",
      endpoints: [
        "/",
        "/health",
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
    return handle(request);
  }
};
