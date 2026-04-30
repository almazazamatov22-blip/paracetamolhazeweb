import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const KP_API_KEY = '5ee2ab49-8a04-436d-ae88-cf6943b51018';
const TMDB_API_KEY = '9e9d7b3624dc47777670354ef25f3cfe';
const KP_BASE = 'https://kinopoiskapiunofficial.tech/api';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const IMDB_TITLES = [
  "Игра престолов", "Во все тяжкие", "Ходячие мертвецы", "Теория большого взрыва", "Шерлок", "Декстер", "Друзья", 
  "Как я встретил вашу маму", "Остаться в живых", "Побег", "Настоящий детектив", "Карточный домик", "Доктор Хаус", 
  "Стрела", "Сверхъестественное", "Симпсоны", "Американская семейка", "Форс-мажоры", "Гриффины", "Южный парк", 
  "Родина", "Дневники вампира", "Сорвиголова", "Задержка в развитии", "Настоящая кровь", "Герои", "Офис", 
  "Два с половиной человека", "Клиника", "Американская история ужасов", "Викинги", "Сопрано", "Прослушка", 
  "Оранжевый - хит сезона", "Светлячок", "Флэш", "Сыны анархии", "Грань", "Спартак: Кровь и песок", "Сайнфелд", 
  "Фарго", "Однажды в сказке", "Анатомия страсти", "Ганнибал", "Мистер Робот", "Футурама", "Лучше звоните Солу", 
  "Доктор Кто", "Секретные материалы", "24 часа", "Блудливая Калифорния", "Сообщество", "Безумцы", "Агенты Щ.И.Т.", 
  "Новенькая", "Подпольная империя", "Красавцы", "В Филадельфии всегда солнечно", "Готэм", "Менталист", 
  "Аватар: Легенда об Аанге", "В поле зрения", "Парки и зоны отдыха", "Звездный крейсер Галактика", "Касл", 
  "Лузеры", "Сплетница", "Милые обманщицы", "Шоу 70-х", "Рим", "Аббатство Даунтон", "Кости", "Нарко", "Тетрадь смерти", 
  "Мыслить как преступник", "Твин Пикс", "Чак", "Чёрный список", "Сотня", "Баффи - истребительница вампиров", 
  "Месть", "Бесстыжие", "Тайны Смолвилля", "Малкольм в центре внимания", "Белый воротничок", "Отчаянные домохозяйки", 
  "Студия 30", "Джессика Джонс", "Компьютерщики", "Хулиганы и ботаны", "Клиент всегда мертв", "Принц из Беверли-Хиллз", 
  "Оборотень", "Арчер", "Теория лжи", "Дурман", "Морская полиция: Спецотдел", "Американский папаша", "Под кудолом", 
  "Гримм", "Меня зовут Эрл", "Служба новостей", "Секс в большом городе", "Топ Гир", "Женаты и с детьми", 
  "Драконий жемчуг Зет", "Страшные сказки", "Древние", "Отбросы", "Рухнувшие небеса", "Последователи", "Элементарно", 
  "Революция", "Рик и Морти", "Две девицы на мели", "Очень странные дела", "Лютер", "Терра Нова", "Лейла и Меджнун", 
  "Тёмное дитя", "Офис", "Убийство", "Ясновидец", "C.S.I. Место преступления", "Тюрьма «ОZ»", "Умерь свой энтузиазм", 
  "Однажды в Калифорнии", "Легенда о Корре", "Дэдвуд", "Бруклин 9-9", "Восьмое чувство", "Звёздный путь: Следующее поколение", 
  "Атака титанов", "Правосудие", "Звёздные врата: ЗВ-1", "Девочки Гилмор", "Мистер Бин", "Бойтесь ходячих мертвецов", 
  "Демоны Да Винчи", "Силиконовая долина", "Король Квинса", "Как избежать наказания за убийство", "Молокососы", 
  "Чёрная метка", "Мотель Бейтсов", "Губка Боб квадратные штаны", "Луи", "Отель «Фолти Тауэрс»", "Чёрное зеркало", 
  "Холм одного дерева", "Острые козырьки", "Зачарованные", "Банши", "Мерлин", "Переростки", "Фрейзер", "Вероника Марс", 
  "Щит", "Вспомни, что будет", "Штамм", "Чёрные Паруса", "Закон и порядок: Специальный корпус", "Бэтмен", "Ковбой Бибоп", 
  "Скандал", "Ангел", "Терминатор: Битва за будущее", "Все любят Рэймонда", "Тюдоры", "Дефективный детектив", 
  "Стальной алхимик: Братство", "Чужестранка", "Звёздный путь", "Девочки", "Хорошая жена", "Агент Картер", 
  "Сонная Лощина", "Звёздные врата: Атлантида", "Люцифер", "Время приключений", "Иерихон", "Гавайи 5.0", "Части тела", 
  "Американцы", "Континуум", "Vизитeры", "Разрушители легенд", "Мертвые до востребования", "Рэй Донован", 
  "Монти Пайтон: Летающий цирк", "Сумеречная зона", "CSI: Место преступления Майами", "Западное крыло", 
  "Наруто: Ураганные хроники", "Супергёрл", "Огни ночной пятницы", "Летучие Конкорды", "Никита", "Убийство на пляже", 
  "На дне", "Полный дом", "Вечность", "Наруто", "Почти человек", "Создавая убийцу", "Массовка", "Книжный магазин Блэка", 
  "Драконий жемчуг", "Кукольный дом", "Ван-Пис", "Скорая помощь", "Долбанутые", "Эврика", "Реальные пацаны", 
  "Тайный круг", "Звёздные врата: Вселенная", "Борджиа", "Звёздный путь: Вояджер", "Марко Поло", "Стальной алхимик", 
  "Третья планета от Солнца", "Закусочная Боба", "Ад на колёсах", "Хранилище 13", "Крах", "Области тьмы", "Шпионка", 
  "Уэйуорд Пайнс", "Связь", "Трудоголики", "Оставленные", "Неуклюжая", "Лига", "Константин", "Уилл и Грейс", 
  "События Прошедшей Недели С Джоном Оливером", "Место преступления Нью-Йорк", "Говорящая с призраками", 
  "Беверли-Хиллз 90210: Новое поколение", "Четыре тысячи четыреста", "Джоуи", "Чёртова служба в госпитале МЭШ", 
  "Последний корабль", "Город хищниц", "Легенды завтрашнего дня", "Царь горы", "Уилфред", "Алькатрас", 
  "Морская полиция: Лос-Анджелес", "Дурнушка"
];

async function getTmdbTextlessPoster(title: string, year: number | null, isSeries: boolean) {
  try {
    const searchType = isSeries ? 'tv' : 'movie';
    const query = encodeURIComponent(title);
    const searchUrl = `${TMDB_BASE}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}${year ? `&${isSeries?'first_air_date_year':'year'}=${year}` : ''}`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const result = searchData.results?.[0];

    if (!result) return null;

    const imagesRes = await fetch(`${TMDB_BASE}/${searchType}/${result.id}/images?api_key=${TMDB_API_KEY}`);
    const imagesData = await imagesRes.json();

    const textlessPoster = imagesData.posters?.find((p: any) => p.iso_639_1 === null);
    
    if (textlessPoster) {
      return `https://image.tmdb.org/t/p/w1280${textlessPoster.file_path}`;
    }

    return null;
  } catch (e) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  let type = searchParams.get('type') || 'TOP_250_BEST_FILMS';
  const cat = searchParams.get('cat') || 'films';

  try {
    const results = [];

    if (cat === 'imdb') {
      const itemsPerPage = 20;
      const start = (page - 1) * itemsPerPage;
      const titlesSubset = IMDB_TITLES.slice(start, start + itemsPerPage);

      if (titlesSubset.length === 0) return NextResponse.json({ message: "Done with IMDb list" });

      for (const title of titlesSubset) {
        const kpSearch = await fetch(`${KP_BASE}/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(title)}&page=1`, {
          headers: { 'X-API-KEY': KP_API_KEY, 'Content-Type': 'application/json' }
        });
        const kpData = await kpSearch.json();
        const film = kpData.films?.[0];

        if (film) {
          const textlessImg = await getTmdbTextlessPoster(film.nameEn || film.nameRu, parseInt(film.year), true);
          const movieData = {
            id: `kp-${film.filmId}`,
            title: film.nameEn || film.nameRu || 'Unknown',
            title_ru: film.nameRu || film.nameEn || 'Без названия',
            image_url: textlessImg || film.posterUrl,
            type: 'series',
            category: film.genres?.[0]?.genre || 'Сериал',
            year: parseInt(film.year) || null,
            is_textless: !!textlessImg
          };
          await supabase.from('kinokadr_movies').upsert(movieData, { onConflict: 'id' });
          results.push({ title, textless: !!textlessImg });
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return NextResponse.json({ message: `Processed IMDB page ${page}`, results });
    }

    const isTopSeries = type === 'TOP_250_TV_SHOWS';
    let url = `${KP_BASE}/v2.2/films/top?type=${type}&page=${page}`;
    if (isTopSeries) url = `${KP_BASE}/v2.2/films?order=RATING&type=TV_SERIES&ratingFrom=8&ratingTo=10&page=${page}`;

    const listRes = await fetch(url, { headers: { 'X-API-KEY': KP_API_KEY, 'Content-Type': 'application/json' } });
    const listData = await listRes.json();
    const items = listData.films || listData.items;

    if (!items) {
      return NextResponse.json({ 
        error: "Kinopoisk API returned no items. Check if the collection type is correct or if you reached rate limit.",
        data: listData 
      }, { status: 400 });
    }

    for (const item of items) {
      const filmId = item.filmId || item.kinopoiskId;
      const name = item.nameEn || item.nameRu;
      const isSer = (item.type?.includes('SERIES') || item.type?.includes('SHOW') || isTopSeries);
      
      const textlessImg = await getTmdbTextlessPoster(name, parseInt(item.year), isSer);

      const movieData = {
        id: `kp-${filmId}`,
        title: item.nameEn || item.nameRu || 'Unknown',
        title_ru: item.nameRu || item.nameEn || 'Без названия',
        image_url: textlessImg || item.posterUrl,
        type: isSer ? 'series' : 'movie',
        category: (item.genres && item.genres[0]) ? item.genres[0].genre : 'Кино',
        year: parseInt(item.year) || null,
        is_textless: !!textlessImg
      };

      await supabase.from('kinokadr_movies').upsert(movieData, { onConflict: 'id' });
      results.push({ title: movieData.title_ru, textless: !!textlessImg });
      await new Promise(r => setTimeout(r, 300));
    }

    return NextResponse.json({ message: `Processed ${type} page ${page}`, results });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
