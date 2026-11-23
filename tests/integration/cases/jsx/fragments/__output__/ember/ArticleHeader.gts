import Component from "@glimmer/component";

export interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  draft: boolean;
  tags: string[];
}

export interface ArticleHeaderSignature {
  Args: ArticleHeaderProps;
  Element: Element;
}

export default class ArticleHeader extends Component<ArticleHeaderSignature> {
  get value1() {
    return this.args.tags.join(", ");
  }

  <template><h2>{{@title}}</h2
    >{{#if @subtitle}}<p class="article-subtitle">{{@subtitle}}</p>{{/if}}{{#if @draft}}<p class="article-badge">Draft</p><p>Only editors can see this article.</p>{{else}}<p
      class="article-badge"
    >Published</p><p>Everyone can read this article.</p>{{/if}}<p>Tagged {{this.value1}}</p></template>
}
