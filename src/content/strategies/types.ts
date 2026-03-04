export type Strategy = {
  name: string;
  match: () => boolean;
  getUserMessageElements: () => HTMLElement[];
};
