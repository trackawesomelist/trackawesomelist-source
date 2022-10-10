# {{{feed.title}}}

{{{feed.description}}}

## Recently Updated

{{#recentlyUpdated}}
- [{{{name}}}]({{{url}}}) - ([Source]({{{source_url}}}))
{{/recentlyUpdated}}

## Top 50 Repos

{{#sortedRepos}}
- [{{{name}}}]({{{url}}}) - ([Source]({{{source_url}}}))
{{/sortedRepos}}

## Awesome List

<details>
<summary>Click to expand</summary>

{{#list}}
- {{category}}
{{#items}}
  - [{{{name}}}]({{{url}}})
{{/items}}
{{/list}}
</details>

## Latest Updated

{{#items}}
### [{{{title}}}](/{{{_slug}}})

{{{content_text}}}

{{/items}}
