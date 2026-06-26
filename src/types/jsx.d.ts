// Declaração do custom element fornecido pelo script do Vturb,
// para o TypeScript/JSX aceitar a tag <vturb-smartplayer>.
declare namespace JSX {
  interface IntrinsicElements {
    "vturb-smartplayer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      id?: string;
    };
  }
}
