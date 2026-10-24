import { buildCatalog } from './catalogCourse';

const course = (id: number, shortname: string, categoryname: string, categorysortorder?: number) => ({
  id,
  shortname,
  fullname: shortname,
  categoryname,
  visible: 1,
  ...(categorysortorder === undefined ? {} : { categorysortorder }),
});

const titles = (raw: unknown[]) => buildCatalog(raw, [], null).map((c) => c.title);

describe('buildCatalog の並び順', () => {
  it('領域内は Moodle の categorysortorder の順に並ぶ', () => {
    expect(
      titles([
        course(10, 'wix', 'Web制作', 20003),
        course(11, 'wordpress', 'Web制作', 20002),
        course(77, 'studio', 'Web制作', 20001),
      ])
    ).toEqual(['studio', 'wordpress', 'wix']);
  });

  it('領域の並びは courseTaxonomy の順のまま（categorysortorder に引きずられない）', () => {
    expect(
      titles([
        course(1, 'wix', 'Web制作', 10001),
        course(2, 'tutorial', '学習ガイド', 90001),
      ])
    ).toEqual(['tutorial', 'wix']);
  });

  it('categorysortorder が無いとき（モック）は courseTaxonomy の宣言順、正典に無いコースは後ろ', () => {
    expect(
      titles([
        course(1, 'studio', 'Web制作'),
        course(2, 'wordpress', 'Web制作'),
        course(3, 'wix', 'Web制作'),
      ])
    ).toEqual(['wix', 'wordpress', 'studio']);
  });
});
