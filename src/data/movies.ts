export interface MovieRecord {
  emoji: string;
  name: string;
  aliases: string[];
  year: number;
  type: 'film' | 'serial';
  genre: string;
  hints: string[];
}

export const movies: MovieRecord[] = [
  { emoji: "🚢🧊🌊💔", name: "Титаник", aliases: ["Titanic"], year: 1997, type: "film", genre: "драма", hints: ["1997 год", "Драма", "Кейт Уинслет"] },
  { emoji: "🧪🚐💎🚬", name: "Во все тяжкие", aliases: ["Breaking Bad"], year: 2008, type: "serial", genre: "криминал", hints: ["2008 год", "Криминал", "Аарон Пол"] },
  { emoji: "⚔️🐉❄️👑", name: "Игра престолов", aliases: ["Game of Thrones"], year: 2011, type: "serial", genre: "фэнтези", hints: ["2011 год", "Фэнтези", "Эмилия Кларк"] },
  { emoji: "🧳🍬🏃‍♂️🦐", name: "Форрест Гамп", aliases: ["Forrest Gump"], year: 1994, type: "film", genre: "драма", hints: ["1994 год", "Драма", "Робин Райт"] },
  { emoji: "🏢🧬💊🕶️", name: "Матрица", aliases: ["The Matrix"], year: 1999, type: "film", genre: "фантастика", hints: ["1999 год", "Фантастика", "Лоренс Фишберн"] },
  { emoji: "🌀💭🏙️💤", name: "Начало", aliases: ["Inception"], year: 2010, type: "film", genre: "фантастика", hints: ["2010 год", "Фантастика", "Джозеф Гордон-Левитт"] },
  { emoji: "🛸🪐📡🚀", name: "Интерстеллар", aliases: ["Interstellar"], year: 2014, type: "film", genre: "фантастика", hints: ["2014 год", "Фантастика", "Энн Хэтэуэй"] },
  { emoji: "🦇🤡🃏🏢", name: "Темный рыцарь", aliases: ["The Dark Knight"], year: 2008, type: "film", genre: "боевик", hints: ["2008 год", "Боевик", "Хит Леджер"] },
  { emoji: "⚡️🧙‍♂️🏰👓", name: "Гарри Поттер", aliases: ["Harry Potter"], year: 2001, type: "film", genre: "фэнтези", hints: ["2001 год", "Фэнтези", "Эмма Уотсон"] },
  { emoji: "🕵️‍♂️🔍🎻🏢", name: "Шерлок", aliases: ["Sherlock"], year: 2010, type: "serial", genre: "детектив", hints: ["2010 год", "Детектив", "Мартин Фриман"] }
];
