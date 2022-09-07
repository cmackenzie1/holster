import slugify from 'slugify';

export const slug = (s: string) => {
  return slugify(s, { lower: true });
};
