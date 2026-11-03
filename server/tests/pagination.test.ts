import { PAGE_SIZE, pageDetails, parsePage } from '../src/pagination';

describe('parsePage', () => {
  it('starts at page 1 when no page is given', () => {
    expect(parsePage(undefined)).toEqual({ page: 1 });
  });

  it.each([['1', 1], ['2', 2], ['10', 10], ['99999', 99999], ['100000', 100000]])('reads %p as page %p', (raw, page) => {
    expect(parsePage(raw)).toEqual({ page });
  });

  it.each(['0', '-3', '1.5', 'x', '', ' 1', '1 ', '1e3', '007', '100001', '9999999', ['1', '2'], { a: '1' }, null, 4])(
    'refuses %p',
    (raw) => {
      expect(parsePage(raw)).toEqual({ error: 'Choose a page number from 1 upward.' });
    },
  );
});

describe('pageDetails', () => {
  it('shows 10 to a page', () => {
    expect(PAGE_SIZE).toBe(10);
  });

  it.each([[0, 1], [1, 1], [10, 1], [11, 2], [20, 2], [21, 3], [95, 10]])('%p items make %p pages', (total, totalPages) => {
    expect(pageDetails(1, total)).toEqual({ page: 1, pageSize: 10, total, totalPages });
  });
});
