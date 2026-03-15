export type Theme =
  | "extraversion"
  | "agreeableness"
  | "conscientiousness"
  | "stability"
  | "openness"
  | "motivation"
  | "communication"
  | "decision"
  | "work"
  | "values";

export type Question = {
  id: number;
  theme: Theme;
  text: string;
  rev?: true;
};

export type ThemeMeta = {
  id: Theme;
  label: string;
  emoji: string;
  desc: string;
};

export const themes: ThemeMeta[] = [
  { id: "extraversion",    label: "エネルギーの向き",       emoji: "⚡", desc: "あなたのエネルギーの使い方について" },
  { id: "agreeableness",   label: "人との関わり方",         emoji: "🤝", desc: "対人場面でのあなたの傾向について" },
  { id: "conscientiousness", label: "行動・計画スタイル",   emoji: "📋", desc: "物事の進め方について" },
  { id: "stability",       label: "感情・ストレス反応",     emoji: "🌊", desc: "感情の動かし方について" },
  { id: "openness",        label: "変化・好奇心",           emoji: "🔭", desc: "新しいことへの向き合い方について" },
  { id: "motivation",      label: "モチベーションの源",     emoji: "🔥", desc: "何でやる気が出るかについて" },
  { id: "communication",   label: "伝え方・受け取り方",     emoji: "💬", desc: "コミュニケーションスタイルについて" },
  { id: "decision",        label: "意思決定スタイル",       emoji: "🧭", desc: "決め方・判断の仕方について" },
  { id: "work",            label: "仕事・学習スタイル",     emoji: "💡", desc: "取り組み方・学び方について" },
  { id: "values",          label: "価値観・大切にすること", emoji: "💎", desc: "何を優先するかについて" },
];

export const labels = ["まったくそう思わない", "あまりそう思わない", "どちらともいえない", "まあそう思う", "とてもそう思う"];

export const questions: Question[] = [
  // テーマ1: 外向性（1-10）
  { id:1,  theme:"extraversion", text:"人と話していると、自然とアイデアや考えが湧いてくる。" },
  { id:2,  theme:"extraversion", text:"初対面の場でも、自分から声をかけるほうだ。" },
  { id:3,  theme:"extraversion", text:"大人数のにぎやかな場は、気力が補充される感じがする。" },
  { id:4,  theme:"extraversion", text:"複数人での会話よりも、1対1のほうが話しやすい。", rev:true },
  { id:5,  theme:"extraversion", text:"一人で作業する時間が長いと、精神的にリフレッシュできる。", rev:true },
  { id:6,  theme:"extraversion", text:"考えをまとめるとき、誰かに話しながら整理することが多い。" },
  { id:7,  theme:"extraversion", text:"会話の中では、相手の発言より自分が先に話すことが多い。" },
  { id:8,  theme:"extraversion", text:"用件だけのやりとりより、少し雑談があるほうが気持ちよく動ける。" },
  { id:9,  theme:"extraversion", text:"静かな環境で一人集中するほうが、本来の力が出やすい。", rev:true },
  { id:10, theme:"extraversion", text:"新しい人に会うのは、どちらかといえばエネルギーを使う。", rev:true },

  // テーマ2: 協調性（11-20）
  { id:11, theme:"agreeableness", text:"相手が言いたいことを、最後まで聞いてから返すことが多い。" },
  { id:12, theme:"agreeableness", text:"誰かが困っていると、自分が忙しくても気になって手を貸したくなる。" },
  { id:13, theme:"agreeableness", text:"意見が対立したとき、相手の立場を理解しようと努める。" },
  { id:14, theme:"agreeableness", text:"頼まれごとを断るとき、相手の気持ちが気になってなかなか断れない。" },
  { id:15, theme:"agreeableness", text:"基本的に、初対面の人でも善意を持って接している。" },
  { id:16, theme:"agreeableness", text:"議論では、勝ち負けより「お互いが納得できるか」が大事だと思う。" },
  { id:17, theme:"agreeableness", text:"誰かがミスをしても、責めるより原因を一緒に考えたい。" },
  { id:18, theme:"agreeableness", text:"場の空気を読まず、自分の意見をはっきり言うほうだ。", rev:true },
  { id:19, theme:"agreeableness", text:"人の言動に疑問を感じても、その場では流すことが多い。" },
  { id:20, theme:"agreeableness", text:"チームよりも個人で動くほうが、結果を出しやすいと感じる。", rev:true },

  // テーマ3: 誠実性（21-30）
  { id:21, theme:"conscientiousness", text:"やることが多くなったら、まずリストにして優先順位を決める。" },
  { id:22, theme:"conscientiousness", text:"締め切りは、できるだけ早めに動いて余裕をもって守る。" },
  { id:23, theme:"conscientiousness", text:"物や書類の置き場所を決めておかないと、落ち着かない。" },
  { id:24, theme:"conscientiousness", text:"一度決めたルールや手順は、きちんと守るほうだ。" },
  { id:25, theme:"conscientiousness", text:"計画を立てずに、その場の感覚で動くことが多い。", rev:true },
  { id:26, theme:"conscientiousness", text:"やり残したことが頭に残っていると、休んでいても気になる。" },
  { id:27, theme:"conscientiousness", text:"仕事や作業は「終わってから休む」派だ。" },
  { id:28, theme:"conscientiousness", text:"後でまとめてやるより、気づいたときにこまめに片づけるほうだ。" },
  { id:29, theme:"conscientiousness", text:"やり始めたことは、途中でやめずに最後まで続けたい。" },
  { id:30, theme:"conscientiousness", text:"準備が整っていなくても、まず動き出すことが多い。", rev:true },

  // テーマ4: 感情安定（31-40）
  { id:31, theme:"stability", text:"予想外のことが起きても、まず深呼吸して落ち着ける。" },
  { id:32, theme:"stability", text:"失敗しても、必要以上に長く自分を責め続けない。" },
  { id:33, theme:"stability", text:"嫌なことがあった日でも、翌朝にはおおむね気持ちを切り替えられる。" },
  { id:34, theme:"stability", text:"心配ごとがあっても、いったん手放して眠ることができる。" },
  { id:35, theme:"stability", text:"ちょっとしたことで、気分が上下しやすい。", rev:true },
  { id:36, theme:"stability", text:"緊張や不安が、体のこわばりや動悸として出やすい。", rev:true },
  { id:37, theme:"stability", text:"失敗したとき、頭の中でくり返し再生してしまうことがある。", rev:true },
  { id:38, theme:"stability", text:"誰かに批判されると、しばらく気持ちを引きずりやすい。", rev:true },
  { id:39, theme:"stability", text:"自分の感情の状態に気づいて、うまく言語化できる。" },
  { id:40, theme:"stability", text:"気持ちが落ちたとき、自分なりの回復方法を持っている。" },

  // テーマ5: 開放性（41-50）
  { id:41, theme:"openness", text:"新しいやり方を試すことに、わくわくする。" },
  { id:42, theme:"openness", text:"知らない分野の話を聞くと、自然と「もっと知りたい」と思う。" },
  { id:43, theme:"openness", text:"自分とまったく異なる考え方の人と話すのは、面白いと感じる。" },
  { id:44, theme:"openness", text:"答えが一つに決まらない問いを、じっくり考えることが好きだ。" },
  { id:45, theme:"openness", text:"本・音楽・映像など作品から、新しいものの見方を得ることがある。" },
  { id:46, theme:"openness", text:"慣れたやり方を変えるのは、なるべく避けたい。", rev:true },
  { id:47, theme:"openness", text:"新しいことよりも、確実にできることを選びがちだ。", rev:true },
  { id:48, theme:"openness", text:"アイデアを考えているとき、時間が経つのを忘れることがある。" },
  { id:49, theme:"openness", text:"「なぜそうなるのか」という仕組みや背景を探りたくなる。" },
  { id:50, theme:"openness", text:"想定外の展開でも、「面白いことになってきた」と感じやすい。" },

  // テーマ6: モチベーション（51-60）
  { id:51, theme:"motivation", text:"少し難しめの目標のほうが、燃える。" },
  { id:52, theme:"motivation", text:"自分でやり方を決められる場面で、一番力が出る。" },
  { id:53, theme:"motivation", text:"「誰かの役に立っている」実感があると、頑張れる。" },
  { id:54, theme:"motivation", text:"一緒に取り組む仲間がいると、やる気が持続しやすい。" },
  { id:55, theme:"motivation", text:"成果や進捗が目に見えると、次の行動に移りやすい。" },
  { id:56, theme:"motivation", text:"先の見通しが立つと、安心して取り組める。" },
  { id:57, theme:"motivation", text:"細かく指示されるより、ある程度任されるほうが伸びる。" },
  { id:58, theme:"motivation", text:"認められたり感謝されたりすることが、大きなエネルギーになる。" },
  { id:59, theme:"motivation", text:"やっていること自体が面白いかどうかが、続けられるかの鍵だ。" },
  { id:60, theme:"motivation", text:"安心・安全な環境が整っていると、実力が発揮しやすい。" },

  // テーマ7: コミュニケーション（61-70）
  { id:61, theme:"communication", text:"用件は「結論→理由」の順番で伝えるほうが、自分には合っている。" },
  { id:62, theme:"communication", text:"相手の感情状態に合わせて、言い方を調整することが多い。" },
  { id:63, theme:"communication", text:"伝えにくいことでも、早めにはっきり言うほうだ。" },
  { id:64, theme:"communication", text:"言いたいことがあっても、タイミングを見計らって後回しにしがちだ。", rev:true },
  { id:65, theme:"communication", text:"会話では、相手の表情や反応を読みながら話している。" },
  { id:66, theme:"communication", text:"文章（チャット・メール）より、話した方が早いと感じることが多い。" },
  { id:67, theme:"communication", text:"フィードバックは、なるべく早くもらうほうが改善につながる。" },
  { id:68, theme:"communication", text:"意見が違うとき、まず共通点を探してから話すことが多い。" },
  { id:69, theme:"communication", text:"自分の考えを、その場で言葉にするのが得意だ。" },
  { id:70, theme:"communication", text:"相手の気持ちを傷つけないよう、言葉を選びすぎて本音が伝わらないことがある。", rev:true },

  // テーマ8: 意思決定（71-80）
  { id:71, theme:"decision", text:"決める前に、必要な情報をできる限り集めてから判断する。" },
  { id:72, theme:"decision", text:"直感で「これだ」と思ったら、早めに動くほうだ。" },
  { id:73, theme:"decision", text:"迷ったら、まず小さく試してみることが多い。" },
  { id:74, theme:"decision", text:"大事な決定の前に、信頼できる人の意見を聞く。" },
  { id:75, theme:"decision", text:"リスクを避けるために、確実な選択肢を優先する。" },
  { id:76, theme:"decision", text:"一度決めたことでも、状況が変われば柔軟に見直せる。" },
  { id:77, theme:"decision", text:"選択肢が多すぎると、なかなか決められない。", rev:true },
  { id:78, theme:"decision", text:"後から「あのときこうすればよかった」と振り返ることが少ない。" },
  { id:79, theme:"decision", text:"完璧に納得できるまで時間がかかり、決断が遅れることがある。", rev:true },
  { id:80, theme:"decision", text:"決めた後は、迷わず実行に集中できる。" },

  // テーマ9: 仕事・学習（81-90）
  { id:81, theme:"work", text:"説明を読むより、実際にやってみながら覚えるほうが身につく。" },
  { id:82, theme:"work", text:"全体像（目的・ゴール）を先に理解してから、詳細に入ると学びやすい。" },
  { id:83, theme:"work", text:"メモや図に整理すると、理解が深まる。" },
  { id:84, theme:"work", text:"複数のことを同時に進めるより、1つずつ片づけるほうが向いている。" },
  { id:85, theme:"work", text:"締め切りが近いほど、集中力が上がる。" },
  { id:86, theme:"work", text:"自分の強みを、言葉で説明できる。" },
  { id:87, theme:"work", text:"苦手なことは、仕組みや道具でカバーする工夫をする。" },
  { id:88, theme:"work", text:"人に説明しながら学ぶと、理解が定着しやすい。" },
  { id:89, theme:"work", text:"新しいことを学ぶとき、失敗への恐れで一歩が踏み出しにくい。", rev:true },
  { id:90, theme:"work", text:"フィードバックをこまめにもらうほうが、成長しやすい。" },

  // テーマ10: 価値観（91-100）
  { id:91,  theme:"values", text:"公平であることは、効率よりも大切だと思う。" },
  { id:92,  theme:"values", text:"自分に不利でも、正直に伝える選択をしたい。" },
  { id:93,  theme:"values", text:"学び続けることを、人生の中で優先したい。" },
  { id:94,  theme:"values", text:"チャレンジや変化より、安定した環境を大切にしたい。", rev:true },
  { id:95,  theme:"values", text:"自分の信念と合わないことに、無理に合わせたくない。" },
  { id:96,  theme:"values", text:"周囲との調和を大切にし、対立をなるべく避けたい。" },
  { id:97,  theme:"values", text:"結果よりも、プロセスや取り組み方を大切にしたい。" },
  { id:98,  theme:"values", text:"誰かの役に立つことが、自分の行動の大きな動機になっている。" },
  { id:99,  theme:"values", text:"自由と裁量を、報酬よりも重視する。" },
  { id:100, theme:"values", text:"成果や実績を積み上げることが、自分を動かす大きな力だ。" },
];
