/**
 * src/config/dailyQuotes.ts
 * -----------------------------------------------------------
 * Deterministic daily quote pool for the Daily Puzzle card.
 * Same date → same quote for all players.
 */

type DailyQuote = {
  text: string;
  attribution?: string; // undefined = intentionally omitted (easter eggs)
};

type SpecialDate = {
  month: number;
  day: number;
  quotes: DailyQuote[]; // array allows year-based cycling
};

const SPECIAL_DATES: SpecialDate[] = [
  { month: 1, day: 25, quotes: [{ text: "The best laid schemes o' mice an' men gang aft agley.", attribution: 'Robert Burns' }] },
  { month: 2, day: 14, quotes: [{ text: 'The course of true love never did run smooth.', attribution: "Lysander, A Midsummer Night's Dream" }] },
  { month: 3, day: 4, quotes: [{ text: 'Once more unto the breach, dear friends, once more!', attribution: 'Henry V' }] },
  { month: 3, day: 14, quotes: [{ text: 'There is geometry in the humming of the strings, there is music in the spacing of the spheres.', attribution: 'Pythagoras' }] },
  { month: 3, day: 15, quotes: [{ text: 'Et tu, Brute?', attribution: 'Caesar, Julius Caesar' }] },
  { month: 4, day: 1, quotes: [{ text: 'Lord, what fools these mortals be!', attribution: "Puck, A Midsummer Night's Dream" }] },
  { month: 4, day: 23, quotes: [{ text: "What's past is prologue.", attribution: 'Antonio, The Tempest' }] },
  { month: 5, day: 4, quotes: [{ text: 'May the Force be with you.', attribution: 'Obi-Wan Kenobi' }] },
  { month: 5, day: 25, quotes: [{ text: "Don't panic.", attribution: "The Hitchhiker's Guide to the Galaxy" }] },
  { month: 6, day: 16, quotes: [{ text: 'History, Stephen said, is a' }] },
  { month: 7, day: 17, quotes: [{ text: '📅' }] },
  { month: 9, day: 19, quotes: [{ text: 'Sir, with no intention to take offence, I deny your right to put words into my mouth.', attribution: 'Captain Smollett, Treasure Island' }] },
  { month: 10, day: 1, quotes: [{ text: 'A word after a word after a word is power.', attribution: 'Margaret Atwood' }] },
  { month: 11, day: 1, quotes: [{ text: 'A writer writes.', attribution: 'Molly Zimmring' }] },
  { month: 11, day: 5, quotes: [{ text: 'Remember, remember the fifth of November.', attribution: 'English folk verse' }] },
  { month: 12, day: 10, quotes: [{ text: 'I have always imagined that Paradise will be a kind of library.', attribution: 'Borges' }] },
  { month: 12, day: 16, quotes: [{ text: 'I declare after all there is no enjoyment like reading!', attribution: 'Miss Bingley, Pride and Prejudice' }] },
  { month: 12, day: 21, quotes: [{ text: "I don't want to retire. I'm not that good at crossword puzzles.", attribution: 'Norman Mailer' }] },
  { month: 12, day: 23, quotes: [
    { text: 'A Festivus for the rest of us!', attribution: 'Frank Costanza' },
    { text: 'I got a lot of problems with you people!', attribution: 'Frank Costanza' },
  ]},
  { month: 12, day: 25, quotes: [{ text: 'To be or not to be, that is the question.', attribution: 'Hamlet' }] },
];

const DAILY_QUOTES: DailyQuote[] = [
  // Shakespeare
  { text: 'Brevity is the soul of wit.', attribution: 'Polonius, Hamlet' },
  { text: 'The readiness is all.', attribution: 'Hamlet' },
  { text: 'The quality of mercy is not strained.', attribution: 'Portia, The Merchant of Venice' },
  { text: 'All that glitters is not gold.', attribution: 'The Prince of Morocco, The Merchant of Venice' },
  { text: "What's in a name?", attribution: 'Juliet, Romeo and Juliet' },
  { text: 'Though she be but little, she is fierce.', attribution: "Helena, A Midsummer Night's Dream" },
  { text: 'Some are born great, some achieve greatness.', attribution: 'Malvolio, Twelfth Night' },
  { text: 'If music be the food of love, play on.', attribution: 'Orsino, Twelfth Night' },
  { text: 'We know what we are, but know not what we may be.', attribution: 'Ophelia, Hamlet' },
  { text: 'Now is the winter of our discontent.', attribution: 'Richard III' },
  { text: 'I am myself alone.', attribution: 'Richard, Henry VI' },
  { text: 'Cry havoc, and let slip the dogs of war!', attribution: 'Mark Antony, Julius Caesar' },
  { text: 'Lay on, Macduff!', attribution: 'Macbeth' },
  { text: 'There is nothing either good or bad, but thinking makes it so.', attribution: 'Hamlet' },
  { text: 'Have at thee!', attribution: 'Tybalt, Romeo and Juliet' },
  { text: "All the world's a stage.", attribution: 'Jaques, As You Like It' },
  { text: "The game's afoot!", attribution: 'Henry V' },

  // Oscar Wilde
  { text: "I am so clever that sometimes I don't understand a single word of what I am saying.", attribution: 'Wilde' },
  { text: 'I have nothing to declare but my genius.', attribution: 'Wilde' },
  { text: 'The world is a stage, but the play is badly cast.', attribution: 'Wilde' },
  { text: 'There is no sin except stupidity.', attribution: 'Wilde' },
  { text: 'This suspense is terrible. I hope it will last.', attribution: 'Wilde' },
  { text: 'Always forgive your enemies; nothing annoys them so much.', attribution: 'Wilde' },
  { text: 'We are all in the gutter, but some of us are looking at the stars.', attribution: 'Wilde' },
  { text: 'Consistency is the last refuge of the unimaginative.', attribution: 'Wilde' },
  { text: 'The very essence of romance is uncertainty.', attribution: 'Wilde' },
  { text: 'If you want to tell people the truth, make them laugh.', attribution: 'Wilde' },
  { text: 'I can resist everything except temptation.', attribution: 'Wilde' },
  { text: 'Experience is merely the name men gave to their mistakes.', attribution: 'Wilde' },
  { text: 'Questions are never indiscreet. Answers sometimes are.', attribution: 'Wilde' },
  { text: 'To love oneself is the beginning of a lifelong romance.', attribution: 'Wilde' },
  { text: 'The truth is rarely pure and never simple.', attribution: 'Wilde' },

  // Mark Twain
  { text: 'The right word and the almost right word — the difference is lightning and a lightning bug.', attribution: 'Twain' },
  { text: 'Anyone who can only think of one way to spell a word obviously lacks imagination.', attribution: 'Twain' },
  { text: 'Truth is stranger than fiction — fiction is obliged to stick to possibilities.', attribution: 'Twain' },
  { text: "I was gratified to be able to answer promptly. I said I didn't know.", attribution: 'Twain' },
  { text: 'A lie can travel halfway around the world while the truth is putting on its shoes.', attribution: 'Twain' },
  { text: 'Clothes make the man. Naked people have little or no influence on society.', attribution: 'Twain' },
  { text: "You can't depend on your eyes when your imagination is out of focus.", attribution: 'Twain' },
  { text: 'Never put off till tomorrow what may be done day after tomorrow just as well.', attribution: 'Twain' },
  { text: 'Good friends, good books, and a sleepy conscience: this is the ideal life.', attribution: 'Twain' },
  { text: 'When angry, count four; when very angry, swear.', attribution: 'Twain' },
  { text: 'All you need in this life is ignorance and confidence; then success is sure.', attribution: 'Twain' },
  { text: 'Let us be thankful for fools. But for them the rest of us could not succeed.', attribution: 'Twain' },

  // Dorothy Parker & Robert Benchley
  { text: 'Wit has truth in it; wisecracking is simply calisthenics with words.', attribution: 'Parker' },
  { text: "I can't write five words but that I change seven.", attribution: 'Parker' },
  { text: 'What fresh hell can this be?', attribution: 'Parker' },
  { text: "You can lead a horticulture, but you can't make her think.", attribution: 'Parker' },
  { text: 'Drawing on my fine command of language, I said nothing.', attribution: 'Benchley' },
  { text: 'Excuse my dust.', attribution: 'Parker' },
  { text: 'Beauty is only skin deep, but ugly goes clean to the bone.', attribution: 'Parker' },

  // Classic Literature & Philosophy
  { text: 'The pen is mightier than the sword.', attribution: 'Bulwer-Lytton' },
  { text: 'Fortune favors the bold.', attribution: 'Virgil' },
  { text: 'The limits of my language are the limits of my world.', attribution: 'Wittgenstein' },
  { text: 'Language is the armory of the human mind.', attribution: 'Coleridge' },
  { text: 'I think, therefore I am.', attribution: 'Descartes' },
  { text: 'Know thyself.', attribution: 'Socrates' },
  { text: 'The unexamined life is not worth living.', attribution: 'Socrates' },
  { text: 'In the beginning was the Word.', attribution: 'John 1:1' },
  { text: 'It was the best of times, it was the worst of times.', attribution: 'Dickens' },
  { text: 'Well begun is half done.', attribution: 'Aristotle' },
  { text: 'A journey of a thousand miles begins with a single step.', attribution: 'Lao Tzu' },
  { text: 'Knowledge is power.', attribution: 'Francis Bacon' },
  { text: 'Per aspera ad astra.', attribution: 'Latin proverb' },
  { text: 'Veni, vidi, vici.', attribution: 'Caesar' },

  // Fictional Characters — novels only
  { text: 'Words are our most inexhaustible source of magic.', attribution: 'Albus Dumbledore' },
  { text: 'It does not do to dwell on dreams and forget to live.', attribution: 'Albus Dumbledore' },
  { text: 'Not all those who wander are lost.', attribution: 'Bilbo Baggins' },
  { text: 'Curiouser and curiouser!', attribution: 'Alice' },
  { text: 'Call me Ishmael.', attribution: 'Ishmael, Moby-Dick' },
  { text: 'As you wish.', attribution: 'Westley, The Princess Bride' },
  { text: 'It is a truth universally acknowledged...', attribution: 'Jane Austen' },
  { text: 'So it goes.', attribution: 'Vonnegut' },
  { text: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.", attribution: 'Nick Carraway, The Great Gatsby' },
  { text: 'Do I dare disturb the universe?', attribution: 'T.S. Eliot' },

  // Poetry & Aphorisms
  { text: 'I took the one less traveled by, and that has made all the difference.', attribution: 'Frost' },
  { text: "Shall I compare thee to a summer's day?", attribution: 'Shakespeare, Sonnet 18' },
  { text: 'Actions speak louder than words.', attribution: 'Proverb' },
  { text: 'Still waters run deep.', attribution: 'Proverb' },
  { text: 'Measure twice, cut once.', attribution: 'Proverb' },
  { text: 'Less is more.', attribution: 'Mies van der Rohe' },
  { text: 'The best time to plant a tree was twenty years ago. The second best time is now.', attribution: 'Proverb' },
  { text: 'All happy families are alike; each unhappy family is unhappy in its own way.', attribution: 'Tolstoy' },

  // Shakespeare (additional)
  { text: 'The robbed that smiles, steals something from the thief.', attribution: 'Duke, Othello' },
  { text: 'What a piece of work is a man!', attribution: 'Hamlet, Hamlet' },
  { text: 'Uneasy lies the head that wears a crown.', attribution: 'King Henry IV, Henry IV Part 2' },
  { text: 'We are such stuff as dreams are made on.', attribution: 'Prospero, The Tempest' },
  { text: 'Nothing will come of nothing.', attribution: 'Lear, King Lear' },
  { text: 'Cowards die many times before their deaths.', attribution: 'Caesar, Julius Caesar' },
  { text: 'Friends, Romans, countrymen, lend me your ears.', attribution: 'Antony, Julius Caesar' },

  // Oscar Wilde (additional)
  { text: 'The only way to get rid of a temptation is to yield to it.', attribution: 'Lord Henry, The Picture of Dorian Gray' },
  { text: 'To define is to limit.', attribution: 'Lord Henry, The Picture of Dorian Gray' },
  { text: 'A man can be happy with any woman as long as he does not love her.', attribution: 'Lord Henry, The Picture of Dorian Gray' },
  { text: 'Memory is the diary we all carry about with us.', attribution: 'Miss Prism, The Importance of Being Earnest' },
  { text: 'I never travel without my diary. One should always have something sensational to read.', attribution: 'Gwendolen, The Importance of Being Earnest' },

  // Jane Austen — character attributed
  { text: 'Vanity and pride are different things, though the words are often used synonymously.', attribution: 'Mary Bennet, Pride and Prejudice' },
  { text: 'Angry people are not always wise.', attribution: 'Elizabeth Bennet, Pride and Prejudice' },
  { text: 'I cannot speak well enough to be unintelligible.', attribution: 'Catherine Morland, Northanger Abbey' },
  { text: 'Seldom, very seldom, does complete truth belong to any human disclosure.', attribution: 'Narrator, Emma' },

  // Dickens (additional)
  { text: 'No one is useless in this world who lightens the burdens of another.', attribution: 'Dr. Marigold, Dr. Marigold' },
  { text: 'There are books of which the backs and covers are by far the best parts.', attribution: 'Narrator, Oliver Twist' },

  // Dostoevsky
  { text: "Above all, don't lie to yourself.", attribution: 'Father Zosima, The Brothers Karamazov' },

  // Poe, Dickinson, Whitman, Frost
  { text: 'I became insane, with long intervals of horrible sanity.', attribution: 'Edgar Allan Poe' },
  { text: 'Hope is the thing with feathers that perches in the soul.', attribution: 'Emily Dickinson' },
  { text: "I'm nobody! Who are you? Are you nobody too?", attribution: 'Emily Dickinson' },
  { text: 'Do I contradict myself? Very well then I contradict myself.', attribution: 'Walt Whitman, Song of Myself' },
  { text: 'I am large, I contain multitudes.', attribution: 'Walt Whitman, Song of Myself' },
  { text: "In three words I can sum up everything I've learned about life: it goes on.", attribution: 'Robert Frost' },

  // Novel characters (additional)
  { text: 'You never really understand a person until you consider things from his point of view.', attribution: 'Atticus Finch, To Kill a Mockingbird' },
  { text: 'When you have eliminated the impossible, whatever remains must be the truth.', attribution: 'Sherlock Holmes, The Sign of the Four' },
  { text: 'I am no bird; and no net ensnares me.', attribution: 'Jane Eyre, Jane Eyre' },
  { text: 'Reader, I married him.', attribution: 'Jane Eyre, Jane Eyre' },
  { text: 'It matters not what someone is born, but what they grow to be.', attribution: 'Albus Dumbledore, Harry Potter and the Goblet of Fire' },

  // Tom Stoppard
  { text: 'Look on every exit as being an entrance somewhere else.', attribution: 'The Player, Rosencrantz and Guildenstern Are Dead' },
  { text: "Words, words. They're all we have to go on.", attribution: 'Guildenstern, Rosencrantz and Guildenstern Are Dead' },
  { text: "Life is a gamble, at terrible odds. If it were a bet you wouldn't take it.", attribution: 'The Player, Rosencrantz and Guildenstern Are Dead' },
  { text: 'There must have been a moment, at the beginning, where we could have said — no. But somehow we missed it.', attribution: 'Guildenstern, Rosencrantz and Guildenstern Are Dead' },

  // Roald Dahl
  { text: 'If you have good thoughts they will shine out of your face like sunbeams and you will always look lovely.', attribution: 'Narrator, The Twits' },
  { text: 'A little nonsense now and then, is relished by the wisest men.', attribution: 'Mr. Wonka, Charlie and the Great Glass Elevator' },
  { text: "Don't worry about the bits you can't understand. Sit back and allow the words to wash around you, like music.", attribution: 'Narrator, Matilda' },

  // Lewis Carroll (additional)
  { text: "We're all mad here.", attribution: "Cheshire Cat, Alice's Adventures in Wonderland" },
  { text: "Why, sometimes I've believed as many as six impossible things before breakfast.", attribution: 'White Queen, Through the Looking-Glass' },
  { text: "It's no use going back to yesterday, because I was a different person then.", attribution: "Alice, Alice's Adventures in Wonderland" },
  { text: 'Begin at the beginning, and go on till you come to the end: then stop.', attribution: "King of Hearts, Alice's Adventures in Wonderland" },

  // Dr. Seuss
  { text: 'I am the Lorax. I speak for the trees, for the trees have no tongues.', attribution: 'The Lorax, The Lorax' },
  { text: 'You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.', attribution: "Narrator, Oh, the Places You'll Go!" },
  { text: "I meant what I said and I said what I meant — an elephant's faithful, one hundred per cent!", attribution: 'Horton, Horton Hatches the Egg' },
  { text: "Unless someone like you cares a whole awful lot, nothing is going to get better. It's not.", attribution: 'The Once-ler, The Lorax' },

  // Robert Louis Stevenson
  { text: "It's a pleasant thing to be young, and have ten toes.", attribution: 'Long John Silver, Treasure Island' },
  { text: "Dead men don't bite.", attribution: 'Long John Silver, Treasure Island' },
  { text: "I'm cap'n here because I'm the best man by a long sea-mile.", attribution: 'Long John Silver, Treasure Island' },

  // Shakespeare — words & language
  { text: 'Words, words, words.', attribution: 'Hamlet, Hamlet' },
  { text: 'Speak the speech, I pray you, trippingly on the tongue.', attribution: 'Hamlet, Hamlet' },
  { text: 'Talking isn\'t doing. It is a kind of good deed to say well; and yet words are not deeds.', attribution: 'Henry VIII, Henry VIII' },
  { text: 'Suit the action to the word, the word to the action.', attribution: 'Hamlet, Hamlet' },
  { text: 'The devil can cite Scripture for his purpose.', attribution: 'Antonio, The Merchant of Venice' },
  { text: "Life's but a walking shadow, a poor player that struts and frets his hour upon the stage.", attribution: 'Macbeth, Macbeth' },

  // Oscar Wilde (additional)
  { text: 'The books that the world calls immoral are books that show the world its own shame.', attribution: 'Lord Henry, The Picture of Dorian Gray' },
  { text: 'Nowadays to be intelligible is to be found out.', attribution: "Lord Augustus, Lady Windermere's Fan" },

  // Lewis Carroll — riddles & wordplay
  { text: 'Why is a raven like a writing-desk?', attribution: "Mad Hatter, Alice's Adventures in Wonderland" },
  { text: 'Take care of the sense and the sounds will take care of themselves.', attribution: "Duchess, Alice's Adventures in Wonderland" },
  { text: 'When I use a word, it means just what I choose it to mean — neither more nor less.', attribution: 'Humpty Dumpty, Through the Looking-Glass' },
  { text: 'The question is whether you can make words mean so many different things.', attribution: 'Alice, Through the Looking-Glass' },

  // Tolkien — the riddle game
  { text: 'This thing all things devours: birds, beasts, trees, flowers; gnaws iron, bites steel; slays king, ruins town.', attribution: 'Gollum, The Hobbit' },
  { text: 'Voiceless it cries, wingless flutters, toothless bites, mouthless mutters.', attribution: 'Gollum, The Hobbit' },
  { text: 'The riddle-game was sacred and of immense antiquity, and even wicked creatures were afraid to cheat.', attribution: 'Narrator, The Hobbit' },

  // Tom Stoppard (additional)
  { text: 'We are tied down to a language which makes up in obscurity what it lacks in style.', attribution: 'Rosencrantz, Rosencrantz and Guildenstern Are Dead' },

  // Orwell — language as power
  { text: "Don't you see that the whole aim of Newspeak is to narrow the range of thought?", attribution: 'Syme, 1984' },
  { text: 'Who controls the past controls the future. Who controls the present controls the past.', attribution: 'Party Slogan, 1984' },
  { text: 'Freedom is the freedom to say that two plus two make four. If that is granted, all else follows.', attribution: 'Winston Smith, 1984' },

  // Virginia Woolf
  { text: 'Lock up your libraries if you like; but there is no gate, no lock, no bolt that you can set upon the freedom of my mind.', attribution: "Virginia Woolf, A Room of One's Own" },

  // Jane Austen (additional)
  { text: 'The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.', attribution: 'Narrator, Northanger Abbey' },
  { text: "A lady's imagination is very rapid; it jumps from admiration to love, from love to matrimony in a moment.", attribution: 'Narrator, Pride and Prejudice' },

  // Dickens (additional)
  { text: 'Procrastination is the thief of time; collar him.', attribution: 'Narrator, David Copperfield' },

  // Arthur Conan Doyle
  { text: 'The world is full of obvious things which nobody by any chance ever observes.', attribution: 'Sherlock Holmes, The Hound of the Baskervilles' },
  { text: 'It is a capital mistake to theorize before one has data.', attribution: 'Sherlock Holmes, A Scandal in Bohemia' },
  { text: 'You have been in Afghanistan, I perceive.', attribution: 'Sherlock Holmes, A Study in Scarlet' },

  // Cervantes
  { text: 'The pen is the tongue of the mind.', attribution: 'Miguel de Cervantes, Don Quixote' },
];

/**
 * Deterministic shuffle using a simple seed-based PRNG.
 * Same seed always produces the same permutation so all players
 * see the same quote on the same day.
 */
function seededShuffle(arr: DailyQuote[], seed: number): DailyQuote[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const j = (s >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SHUFFLED_QUOTES = seededShuffle(DAILY_QUOTES, 0x4352_4F53);

/**
 * Returns the deterministic quote for a given date.
 * Same date = same quote for every player.
 */
export function getDailyQuote(date: Date = new Date()): DailyQuote {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  // 1. Special date override
  const special = SPECIAL_DATES.find(s => s.month === month && s.day === day);
  if (special) {
    if (special.quotes.length === 1) return special.quotes[0];
    return special.quotes[year % special.quotes.length];
  }

  // 2. General rotation — deterministic, shared across all players
  const daysSinceEpoch = Math.floor(date.getTime() / 86400000);
  return SHUFFLED_QUOTES[daysSinceEpoch % SHUFFLED_QUOTES.length];
}
