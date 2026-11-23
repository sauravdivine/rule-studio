const date = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
export const formatDate = (iso: string) => date.format(new Date(iso));
