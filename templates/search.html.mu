<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5">
    <meta name="msapplication-TileColor" content="#da532c">
    <meta name="theme-color" content="#ffffff">
    <title>{{{_seo_title}}}</title>
    <meta property="og:url" content="{{{home_page_url}}}" />
    <meta property="og:type" content="summary" />
    <meta property="og:title" content="{{ title }}" />
    <meta property="og:description" content="{{ description }}" />
    <meta property="og:site_name" content="{{ _site_title }}" />
    <style>
      main {
        max-width: 1024px;
        margin: 0 auto;
      }
      a{
        color: #000;
      }
      a:hover{
        color: #000;
      }
      a:visited{
        color: #000;
      }
      .search-ui{
          position:relative
        }
      .morsels-root{
          width: 100%;
        }
      #morsels-search {
          width: 100%;
          padding: 1em;
      }
    </style>
    <link rel="stylesheet" href="/search-index/assets/search-ui-basic.css" />
  </head>
  <body>
    <main data-color-mode="light" data-light-theme="light" data-dark-theme="dark" class="markdown-body">
      <h1>Search <a href="/">Awesome</a> Stuff</h1>
      <div id="search-ui">
        <input type="search" id="morsels-search" placeholder="Search" role="combobox" autocomplete="off" aria-autocomplete="list" aria-controls="morsels-mdbook-target" aria-expanded="false">
        <div id="target">
        </div>
      </div>

    </main>

    <!--  Search UI script -->
    <script src="/search-index/assets/search-ui.ascii.bundle.js"></script>
    <script>

    // check is there is q query in the url
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');


    morsels.initMorsels({
      searcherOptions: {
        // Output folder url specified as the second parameter in the cli command
        // Urls like '/output/' will work as well
        url: '/search-index/',
      },
      uiOptions: {
        // Input / source folder url, specified as the first parameter in the cli command
        mode:"target",
        sourceFilesUrl: '/',
        input: 'morsels-search',
        dropdown:"bottom-start",
        resultsPerPage:25,
        target:"target"
      },

});
    if(query){
        // focus input first
        const inputElement = document.getElementById("morsels-search");
        inputElement.focus();

            setTimeout(()=>{

        document.getElementById("morsels-search").value = query;
        // trigger search
        const changeEvent = new Event('input');
        inputElement.dispatchEvent(changeEvent);
    },10)
    }

    </script>
  </body>
</html>
