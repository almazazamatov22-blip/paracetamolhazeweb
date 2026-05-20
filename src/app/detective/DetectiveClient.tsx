"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Fingerprint,
  FolderOpen,
  GitBranch,
  KeyRound,
  Lock,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Network,
  Radio,
  Search,
  Send,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  detectiveCases,
  getCaseById,
  type DetectiveCase,
  type DetectiveCaseId,
  type Evidence,
  type EvidenceKind,
  type Suspect,
  type TabId,
} from "./case-data";

type NpcMessage = {
  from: "player" | "npc";
  text: string;
  time: string;
};

type TheoryState = {
  suspect: string;
  motive: string;
  proof: string[];
};

const detectiveFont: CSSProperties = {
  fontFamily: '"Segoe UI", Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  letterSpacing: 0,
};

const monoFont: CSSProperties = {
  fontFamily: '"Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  letterSpacing: 0,
};

const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "summary", label: "Сводка", icon: FileText },
  { id: "evidence", label: "Улики", icon: Fingerprint },
  { id: "messages", label: "Переписки", icon: MessageSquare },
  { id: "timeline", label: "Линия времени", icon: Clock },
  { id: "network", label: "Связи", icon: Network },
];

const kindIcon: Record<EvidenceKind, typeof FileText> = {
  stream: MonitorPlay,
  chat: MessageSquare,
  image: Camera,
  cctv: Camera,
  gps: MapPin,
  email: FileText,
  social: Radio,
  browser: Search,
  access: KeyRound,
  audio: Radio,
  demo: MonitorPlay,
};

const kindLabel: Record<EvidenceKind, string> = {
  stream: "запись",
  chat: "чат",
  image: "изображение",
  cctv: "камера",
  gps: "геолокация",
  email: "почта",
  social: "соцсеть",
  browser: "браузер",
  access: "доступ",
  audio: "аудио",
  demo: "демо",
};

const statusLabel = {
  open: "открыта",
  volatile: "нестабильна",
  tampered: "изменена",
  fake: "сомнительна",
  locked: "закрыта",
  recovered: "восстановлена",
} as const;

const colorClasses: Record<Suspect["color"], string> = {
  blue: "border-sky-300/35 bg-sky-300/10 text-sky-50",
  amber: "border-amber-300/40 bg-amber-300/10 text-amber-50",
  red: "border-rose-300/40 bg-rose-300/10 text-rose-50",
  green: "border-emerald-300/35 bg-emerald-300/10 text-emerald-50",
};

const caseAccent: Record<DetectiveCaseId, { line: string; soft: string; text: string; svg: string }> = {
  habarhub: {
    line: "border-orange-300/45",
    soft: "bg-orange-300/10",
    text: "text-orange-100",
    svg: "#fb923c",
  },
  keanu: {
    line: "border-cyan-300/40",
    soft: "bg-cyan-300/10",
    text: "text-cyan-100",
    svg: "#67e8f9",
  },
  donk: {
    line: "border-lime-300/40",
    soft: "bg-lime-300/10",
    text: "text-lime-100",
    svg: "#bef264",
  },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll("ё", "е");
}

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildInitialChat(currentCase: DetectiveCase) {
  return Object.fromEntries(
    currentCase.suspects.map((suspect) => [
      suspect.id,
      [
        {
          from: "npc" as const,
          text: `Я на связи. Только без публичных обвинений. Спрашивайте конкретно: время, файл, доступ или переписка.`,
          time: "сейчас",
        },
      ],
    ]),
  );
}

function buildPressure(currentCase: DetectiveCase) {
  return Object.fromEntries(currentCase.suspects.map((suspect) => [suspect.id, suspect.stress]));
}

function pressureDelta(text: string) {
  const normalized = normalize(text);
  const hotWords = [
    "удал",
    "лог",
    "доступ",
    "деньги",
    "кошелек",
    "ставки",
    "obs",
    "дем",
    "hash",
    "discord",
    "telegram",
    "облако",
    "сцена",
    "маска",
    "deepfake",
    "донат",
    "архив",
  ];

  return hotWords.reduce((score, word) => score + (normalized.includes(word) ? 8 : 0), 5);
}

function matchTerminalEvidence(currentCase: DetectiveCase, input: string, unlocked: string[]) {
  const normalized = normalize(input);
  return currentCase.evidence.find((item) => {
    if (item.status !== "locked" || unlocked.includes(item.id)) return false;
    return item.unlockHints?.some((hint) => normalized.includes(normalize(hint)));
  });
}

function findAnswerRule(suspect: Suspect, question: string) {
  const normalized = normalize(question);
  return suspect.answers.find((rule) => rule.keywords.some((keyword) => normalized.includes(normalize(keyword))));
}

export default function DetectiveClient() {
  const [caseId, setCaseId] = useState<DetectiveCaseId | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLog, setTerminalLog] = useState<string[]>([]);
  const [chat, setChat] = useState<Record<string, NpcMessage[]>>({});
  const [pressure, setPressure] = useState<Record<string, number>>({});
  const [question, setQuestion] = useState("");
  const [theory, setTheory] = useState<TheoryState>({ suspect: "", motive: "", proof: [] });
  const [theoryResult, setTheoryResult] = useState("");

  const currentCase = caseId ? getCaseById(caseId) : null;

  const visibleEvidence = useMemo(() => {
    if (!currentCase) return [];
    return currentCase.evidence.filter((item) => item.status !== "locked" || unlocked.includes(item.id));
  }, [currentCase, unlocked]);

  const lockedEvidence = useMemo(() => {
    if (!currentCase) return [];
    return currentCase.evidence.filter((item) => item.status === "locked" && !unlocked.includes(item.id));
  }, [currentCase, unlocked]);

  const selectedEvidence = currentCase?.evidence.find((item) => item.id === selectedEvidenceId) ?? visibleEvidence[0];
  const selectedSuspect = currentCase?.suspects.find((item) => item.id === selectedSuspectId) ?? currentCase?.suspects[0];
  const progress = currentCase ? Math.round((visibleEvidence.length / currentCase.evidence.length) * 100) : 0;

  function openCase(nextCase: DetectiveCase) {
    setCaseId(nextCase.id);
    setActiveTab("summary");
    setUnlocked(nextCase.initialUnlocked);
    setSelectedEvidenceId(nextCase.starterEvidenceId);
    setSelectedSuspectId(nextCase.starterSuspectId);
    setTerminalInput("");
    setTerminalLog([
      `Дело открыто: ${nextCase.title}`,
      "Индексация выключена: раздел доступен только по прямому адресу",
      `Подсказки поиска: ${nextCase.terminalTips.join(", ")}`,
    ]);
    setChat(buildInitialChat(nextCase));
    setPressure(buildPressure(nextCase));
    setQuestion("");
    setTheory({
      suspect: nextCase.starterSuspectId,
      motive: "",
      proof: [nextCase.starterEvidenceId],
    });
    setTheoryResult("");
  }

  function revealEvidence(item: Evidence, reason: string) {
    setUnlocked((current) => (current.includes(item.id) ? current : [...current, item.id]));
    setSelectedEvidenceId(item.id);
    setActiveTab("evidence");
    setTerminalLog((current) => [`Открыта улика: ${item.title}. ${reason}`, ...current].slice(0, 7));
  }

  function runTerminal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentCase) return;

    const raw = terminalInput.trim();
    if (!raw) return;

    const found = matchTerminalEvidence(currentCase, raw, unlocked);
    setTerminalInput("");

    if (found) {
      revealEvidence(found, "Совпали поисковые признаки.");
      return;
    }

    const normalized = normalize(raw);
    if (normalized.includes("таймлайн") || normalized.includes("время") || normalized.includes("сравнить")) {
      setActiveTab("timeline");
      setTerminalLog((current) => [`Собрана линия времени по запросу: ${raw}`, ...current].slice(0, 7));
      return;
    }

    setTerminalLog((current) => [
      `Нет прямого совпадения: ${raw}`,
      "Ищите по связке: источник + объект. Например: 'лог донатов', 'cdn лог', 'hash dem'.",
      ...current,
    ].slice(0, 7));
  }

  function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentCase || !selectedSuspect) return;

    const clean = question.trim();
    if (!clean) return;

    const rule = findAnswerRule(selectedSuspect, clean);
    const newPressure = Math.min(100, (pressure[selectedSuspect.id] ?? selectedSuspect.stress) + pressureDelta(clean));
    const answer =
      rule && newPressure >= 70 && rule.pressed
        ? rule.pressed
        : rule?.answer ??
          `Я не понимаю, к чему вы ведете. Если есть файл, лог или время - покажите это, а не делайте выводы из слухов.`;
    const time = nowTime();

    setPressure((current) => ({ ...current, [selectedSuspect.id]: newPressure }));
    setChat((current) => ({
      ...current,
      [selectedSuspect.id]: [
        ...(current[selectedSuspect.id] ?? []),
        { from: "player" as const, text: clean, time },
        { from: "npc" as const, text: answer, time },
      ].slice(-12),
    }));
    setQuestion("");

    if (rule?.unlockEvidenceId && newPressure >= (rule.unlockAt ?? 72)) {
      const item = currentCase.evidence.find((evidenceItem) => evidenceItem.id === rule.unlockEvidenceId);
      if (item && !unlocked.includes(item.id)) {
        revealEvidence(item, "Собеседник выдал противоречие.");
      }
    }
  }

  function toggleTheoryEvidence(id: string) {
    setTheory((current) => ({
      ...current,
      proof: current.proof.includes(id)
        ? current.proof.filter((item) => item !== id)
        : [...current.proof, id].slice(-5),
    }));
  }

  function submitTheory() {
    if (!currentCase) return;

    const recoveredCount = theory.proof.filter((id) => {
      const item = currentCase.evidence.find((evidenceItem) => evidenceItem.id === id);
      return item?.status === "locked";
    }).length;

    if (theory.proof.length >= 4 && recoveredCount >= 1 && theory.motive.trim().length > 18) {
      setTheoryResult(
        "Версия выглядит рабочей: есть мотив, цифровой след и хотя бы одна восстановленная улика. Теперь проверьте слабое место: кто физически или технически мог сделать действие.",
      );
      return;
    }

    if (theory.proof.length >= 3) {
      setTheoryResult(
        "Версия возможна, но пока держится на косвенных связях. Нужна восстановленная улика или прямое противоречие в допросе.",
      );
      return;
    }

    setTheoryResult("Пока это гипотеза, а не доказанная версия. Добавьте улики и сформулируйте мотив.");
  }

  if (!currentCase) {
    return <CaseMenu onOpenCase={openCase} />;
  }

  return (
    <main style={detectiveFont} className="min-h-screen bg-[#080807] text-stone-100">
      <div className="border-b border-stone-800 bg-[#0e0f0d]">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCaseId(null)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-stone-700 bg-stone-950 text-stone-200 hover:border-stone-400"
              aria-label="Вернуться к архиву дел"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-md border", caseAccent[currentCase.id].line, caseAccent[currentCase.id].soft)}>
              <ShieldAlert className={cx("h-5 w-5", caseAccent[currentCase.id].text)} />
            </div>
            <div className="min-w-0">
              <div style={monoFont} className="text-xs uppercase text-stone-500">
                закрытый раздел / не индексируется
              </div>
              <h1 className="truncate text-2xl font-semibold text-stone-50">{currentCase.title}</h1>
              <p className="truncate text-sm text-stone-400">Связано с: {currentCase.connectedTo}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:flex">
            <Metric label="открыто" value={`${visibleEvidence.length}/${currentCase.evidence.length}`} />
            <Metric label="прогресс" value={`${progress}%`} />
            <Metric label="сложность" value={currentCase.difficulty} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1680px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[310px_minmax(0,1fr)_390px]">
        <aside className="space-y-4">
          <section className="rounded-md border border-stone-800 bg-[#10110f] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
              <FolderOpen className="h-4 w-4" />
              Паспорт дела
            </div>
            <p className="text-sm leading-6 text-stone-300">{currentCase.description}</p>
            <div className="mt-4 h-2 rounded bg-stone-900">
              <div className="h-full rounded bg-stone-100" style={{ width: `${progress}%` }} />
            </div>
          </section>

          <nav className="grid gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "flex min-h-11 items-center justify-between rounded-md border px-3 text-left text-sm transition",
                    activeTab === tab.id
                      ? "border-stone-100 bg-stone-100 text-stone-950"
                      : "border-stone-800 bg-[#10110f] text-stone-300 hover:border-stone-500",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="rounded-md border border-stone-800 bg-[#10110f] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
              <Terminal className="h-4 w-4" />
              Поиск по уликам
            </div>
            <form onSubmit={runTerminal} className="flex gap-2">
              <input
                value={terminalInput}
                onChange={(event) => setTerminalInput(event.target.value)}
                className="min-h-10 min-w-0 flex-1 rounded-md border border-stone-800 bg-stone-950 px-3 text-sm text-stone-100 outline-none focus:border-stone-400"
                placeholder="например: лог донатов"
              />
              <button
                type="submit"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-stone-100 bg-stone-100 text-stone-950 hover:bg-white"
                aria-label="Запустить поиск"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
            <div style={monoFont} className="mt-3 grid gap-2 text-xs text-stone-400">
              {terminalLog.map((line, index) => (
                <div key={`${line}-${index}`} className="border-l border-stone-700 pl-2">
                  {line}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-stone-800 bg-[#10110f] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
              <Lock className="h-4 w-4" />
              Закрытые артефакты
            </div>
            <div className="grid gap-2">
              {lockedEvidence.length === 0 && <p className="text-sm text-stone-500">Все артефакты по делу восстановлены.</p>}
              {lockedEvidence.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTerminalInput(item.unlockHints?.[0] ?? item.title)}
                  className="flex items-center justify-between gap-3 rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-left text-xs text-stone-400 hover:border-stone-600"
                >
                  <span className="truncate">{item.title}</span>
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-md border border-stone-800 bg-[#10110f]">
          {activeTab === "summary" && (
            <SummaryPanel currentCase={currentCase} onOpenSuspect={(id) => {
              setSelectedSuspectId(id);
              setActiveTab("network");
            }} />
          )}

          {activeTab === "evidence" && selectedEvidence && (
            <div className="grid min-h-[720px] gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
              <div className="max-h-[780px] overflow-auto border-b border-stone-800 lg:border-b-0 lg:border-r">
                {visibleEvidence.map((item) => {
                  const Icon = kindIcon[item.kind];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedEvidenceId(item.id)}
                      className={cx(
                        "block w-full border-b border-stone-800 p-4 text-left transition",
                        selectedEvidence.id === item.id ? "bg-stone-100 text-stone-950" : "bg-[#10110f] text-stone-200 hover:bg-stone-950",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate font-medium">{item.title}</span>
                        </span>
                        <span style={monoFont} className="text-xs opacity-60">
                          {item.reliability}%
                        </span>
                      </div>
                      <div className="text-sm leading-5 opacity-75">{item.summary}</div>
                    </button>
                  );
                })}
              </div>

              <EvidenceDetail item={selectedEvidence} recovered={selectedEvidence.status === "locked" && unlocked.includes(selectedEvidence.id)} />
            </div>
          )}

          {activeTab === "messages" && <MessagesPanel currentCase={currentCase} />}

          {activeTab === "timeline" && <TimelinePanel currentCase={currentCase} />}

          {activeTab === "network" && selectedSuspect && (
            <NetworkPanel
              currentCase={currentCase}
              selectedSuspect={selectedSuspect}
              selectedSuspectId={selectedSuspectId}
              pressure={pressure}
              visibleEvidence={visibleEvidence}
              theory={theory}
              theoryResult={theoryResult}
              onSelectSuspect={setSelectedSuspectId}
              onSetTheory={setTheory}
              onToggleTheoryEvidence={toggleTheoryEvidence}
              onSubmitTheory={submitTheory}
            />
          )}
        </section>

        {selectedSuspect && (
          <aside className="rounded-md border border-stone-800 bg-[#10110f]">
            <div className="border-b border-stone-800 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
                <MessageSquare className="h-4 w-4" />
                Канал допроса
              </div>
              <div className="grid grid-cols-2 gap-2">
                {currentCase.suspects.map((suspect) => (
                  <button
                    key={suspect.id}
                    type="button"
                    onClick={() => setSelectedSuspectId(suspect.id)}
                    className={cx(
                      "rounded-md border px-3 py-2 text-left text-xs transition",
                      selectedSuspectId === suspect.id
                        ? colorClasses[suspect.color]
                        : "border-stone-800 bg-stone-950 text-stone-400 hover:border-stone-600",
                    )}
                  >
                    <div className="truncate font-medium">{suspect.name}</div>
                    <div style={monoFont} className="opacity-70">
                      стресс {pressure[suspect.id] ?? suspect.stress}%
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[560px] min-h-[420px] overflow-auto p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-md border border-stone-700 bg-stone-950 text-sm font-semibold">
                  {selectedSuspect.avatar}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{selectedSuspect.name}</div>
                  <div style={monoFont} className="truncate text-xs text-stone-500">
                    {selectedSuspect.username}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {(chat[selectedSuspectId] ?? []).map((message, index) => (
                  <div
                    key={`${selectedSuspectId}-${message.time}-${index}`}
                    className={cx(
                      "max-w-[92%] rounded-md border p-3 text-sm leading-6",
                      message.from === "player"
                        ? "ml-auto border-stone-600 bg-stone-100 text-stone-950"
                        : "border-stone-800 bg-stone-950 text-stone-300",
                    )}
                  >
                    <div style={monoFont} className="mb-1 text-[10px] uppercase opacity-50">
                      {message.from === "player" ? "детектив" : selectedSuspect.username} / {message.time}
                    </div>
                    {message.text}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={sendQuestion} className="border-t border-stone-800 p-4">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="min-h-24 w-full resize-none rounded-md border border-stone-800 bg-stone-950 p-3 text-sm leading-6 text-stone-100 outline-none focus:border-stone-400"
                placeholder="Задайте вопрос по конкретной улике"
              />
              <button
                type="submit"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-stone-100 bg-stone-100 px-4 text-sm font-medium text-stone-950 hover:bg-white"
              >
                <Send className="h-4 w-4" />
                Отправить вопрос
              </button>
            </form>
          </aside>
        )}
      </div>
    </main>
  );
}

function CaseMenu({ onOpenCase }: { onOpenCase: (nextCase: DetectiveCase) => void }) {
  return (
    <main style={detectiveFont} className="min-h-screen bg-[#080807] text-stone-100">
      <section className="mx-auto grid min-h-screen w-full max-w-[1500px] grid-rows-[auto_minmax(0,1fr)_auto] gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-stone-800 bg-stone-950 px-3 py-2 text-sm text-stone-300">
              <ShieldAlert className="h-4 w-4 text-rose-200" />
              Закрытый раздел. В главное меню сайта не добавлен.
            </div>
            <h1 className="text-4xl font-semibold text-stone-50 sm:text-5xl">Архив расследований</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
              Выберите дело, изучайте цифровые следы, давите на противоречия и собирайте версию. Все три сюжета вымышлены; публичные имена используются как контекст ARG, а не как обвинение реальных людей.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="дела" value="3" />
            <Metric label="улики" value="26" />
            <Metric label="режим" value="онлайн" />
          </div>
        </header>

        <div className="grid content-center gap-4 lg:grid-cols-3">
          {detectiveCases.map((item) => (
            <article
              key={item.id}
              className={cx(
                "group grid min-h-[560px] grid-rows-[220px_auto] overflow-hidden rounded-md border bg-[#10110f] shadow-2xl shadow-black/30 transition hover:-translate-y-1",
                caseAccent[item.id].line,
              )}
            >
              <CaseSignalArt currentCase={item} />
              <div className="grid gap-4 p-5">
                <div>
                  <div className={cx("mb-2 inline-flex rounded-md border px-2 py-1 text-xs", caseAccent[item.id].line, caseAccent[item.id].soft, caseAccent[item.id].text)}>
                    {item.connectedTo}
                  </div>
                  <h2 className="text-2xl font-semibold text-stone-50">{item.menuTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{item.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SmallFact label="сложность" value={item.difficulty} />
                  <SmallFact label="подозреваемые" value={`${item.suspects.length}`} />
                  <SmallFact label="улики" value={`${item.evidence.length}`} />
                  <SmallFact label="формат" value={item.mood} wide />
                </div>

                <button
                  type="button"
                  onClick={() => onOpenCase(item)}
                  className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-stone-100 bg-stone-100 px-4 text-sm font-semibold text-stone-950 transition hover:bg-white"
                >
                  <FolderOpen className="h-4 w-4" />
                  Открыть дело
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-stone-800 pt-4 text-sm text-stone-500">
          Доступ напрямую: /detective. Страница закрыта от индексации и не размещена на главной.
        </footer>
      </section>
    </main>
  );
}

function CaseSignalArt({ currentCase }: { currentCase: DetectiveCase }) {
  const accent = caseAccent[currentCase.id].svg;
  const label = currentCase.id === "habarhub" ? "HABAR" : currentCase.id === "keanu" ? "K-09" : "D-22";

  return (
    <div className="relative overflow-hidden bg-[#0a0b0a]">
      <svg viewBox="0 0 720 360" className="h-full w-full" role="img" aria-label={`Обложка дела ${currentCase.menuTitle}`}>
        <rect width="720" height="360" fill="#0a0b0a" />
        <path d="M0 72H720M0 144H720M0 216H720M0 288H720M90 0V360M180 0V360M270 0V360M360 0V360M450 0V360M540 0V360M630 0V360" stroke="#292824" strokeWidth="1" />
        <rect x="46" y="42" width="226" height="138" fill="none" stroke={accent} strokeOpacity="0.65" strokeWidth="2" />
        <rect x="448" y="58" width="210" height="128" fill="none" stroke="#f5f5f4" strokeOpacity="0.16" strokeWidth="2" />
        <path d="M72 244C118 202 142 282 190 238C238 194 276 266 320 224C362 184 404 260 452 218C500 176 544 244 622 206" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
        <path d="M96 86H218M96 118H176M96 150H234" stroke="#f5f5f4" strokeOpacity="0.72" strokeWidth="9" strokeLinecap="round" />
        <path d="M474 96H612M474 132H580M474 164H635" stroke={accent} strokeOpacity="0.82" strokeWidth="8" strokeLinecap="round" />
        <circle cx="362" cy="112" r="34" fill="none" stroke={accent} strokeOpacity="0.7" strokeWidth="3" />
        <path d="M362 78V146M328 112H396" stroke={accent} strokeOpacity="0.7" strokeWidth="3" />
        <text x="48" y="316" fill="#f5f5f4" fontSize="44" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700">
          {label}
        </text>
        <text x="48" y="340" fill="#a8a29e" fontSize="18" fontFamily="Segoe UI, Arial, sans-serif">
          цифровое расследование
        </text>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-16 border-t border-stone-700/40 bg-[#0a0b0a]/80" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-800 bg-stone-950 px-3 py-2">
      <div className="text-xs text-stone-500">{label}</div>
      <div style={monoFont} className="text-base text-stone-100">
        {value}
      </div>
    </div>
  );
}

function SmallFact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cx("rounded-md border border-stone-800 bg-stone-950 p-3", wide && "col-span-2")}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-sm text-stone-200">{value}</div>
    </div>
  );
}

function SummaryPanel({ currentCase, onOpenSuspect }: { currentCase: DetectiveCase; onOpenSuspect: (id: string) => void }) {
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-md border border-stone-800 bg-stone-950 p-4">
          <div className="mb-2 text-sm font-semibold text-stone-200">Что произошло</div>
          <p className="text-base leading-7 text-stone-300">{currentCase.whatHappened}</p>
          <div className="mt-4 border-t border-stone-800 pt-4">
            <div className="mb-2 text-sm font-semibold text-stone-200">Главная тайна</div>
            <p className="leading-7 text-stone-300">{currentCase.mainMystery}</p>
          </div>
          <div className="mt-4 border-t border-stone-800 pt-4">
            <div className="mb-2 text-sm font-semibold text-stone-200">Задача игрока</div>
            <p className="leading-7 text-stone-300">{currentCase.investigatorGoal}</p>
          </div>
        </section>

        <section className="rounded-md border border-stone-800 bg-stone-950 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
            <AlertTriangle className="h-4 w-4 text-amber-200" />
            Ложные следы
          </div>
          <div className="grid gap-3">
            {currentCase.falseLeads.map((lead) => (
              <div key={lead} className="border-l border-stone-700 pl-3 text-sm leading-6 text-stone-300">
                {lead}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {currentCase.suspects.map((suspect) => (
          <button
            key={suspect.id}
            type="button"
            onClick={() => onOpenSuspect(suspect.id)}
            className={cx("min-h-56 rounded-md border bg-stone-950 p-4 text-left transition hover:-translate-y-0.5", colorClasses[suspect.color])}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md border border-current/40 bg-black/30 text-sm font-semibold">
                {suspect.avatar}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{suspect.name}</div>
                <div style={monoFont} className="truncate text-xs opacity-70">
                  {suspect.username}
                </div>
              </div>
            </div>
            <div className="text-sm leading-6 text-stone-300">{suspect.role}</div>
            <div className="mt-3 text-xs text-stone-500">Алиби</div>
            <div className="text-sm leading-6 text-stone-300">{suspect.alibi}</div>
          </button>
        ))}
      </div>

      <section className="rounded-md border border-stone-800 bg-stone-950 p-4">
        <div className="mb-3 text-sm font-semibold text-stone-200">Возможные концовки</div>
        <div className="grid gap-3 md:grid-cols-3">
          {currentCase.endings.map((ending) => (
            <div key={ending} className="rounded-md border border-stone-800 bg-[#10110f] p-3 text-sm leading-6 text-stone-300">
              {ending}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EvidenceDetail({ item, recovered }: { item: Evidence; recovered: boolean }) {
  const Icon = kindIcon[item.kind];
  const displayStatus = recovered ? "recovered" : item.status;

  return (
    <article className="min-w-0 p-4 lg:p-6">
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-stone-800 pb-5 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm text-stone-500">
            <Icon className="h-4 w-4" />
            {kindLabel[item.kind]} / {item.source}
          </div>
          <h2 className="text-2xl font-semibold text-stone-50">{item.title}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:w-52">
          <div className="rounded-md border border-stone-800 bg-stone-950 p-2">
            <div className="text-stone-500">время</div>
            <div style={monoFont} className="text-stone-100">
              {item.time}
            </div>
          </div>
          <div className="rounded-md border border-stone-800 bg-stone-950 p-2">
            <div className="text-stone-500">доверие</div>
            <div style={monoFont} className="text-stone-100">
              {item.reliability}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <section className="rounded-md border border-stone-800 bg-stone-950 p-4">
            <div className="mb-2 text-sm font-semibold text-stone-200">Содержимое</div>
            <p className="leading-7 text-stone-300">{item.body}</p>
          </section>
          <section className="rounded-md border border-rose-300/25 bg-rose-950/20 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              Противоречие
            </div>
            <p className="leading-7 text-rose-50">{item.contradiction}</p>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-stone-800 bg-stone-950 p-4">
            <div className="mb-3 text-sm font-semibold text-stone-200">Статус</div>
            <div
              className={cx(
                "inline-flex rounded-md border px-3 py-2 text-xs uppercase",
                displayStatus === "open" && "border-emerald-300/40 text-emerald-200",
                displayStatus === "recovered" && "border-emerald-300/40 text-emerald-200",
                displayStatus === "volatile" && "border-amber-300/40 text-amber-100",
                displayStatus === "tampered" && "border-rose-300/40 text-rose-100",
                displayStatus === "fake" && "border-stone-500 text-stone-300",
                displayStatus === "locked" && "border-stone-700 text-stone-500",
              )}
            >
              {statusLabel[displayStatus]}
            </div>
          </div>

          <div className="rounded-md border border-stone-800 bg-stone-950 p-4">
            <div className="mb-3 text-sm font-semibold text-stone-200">Метки</div>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-md border border-stone-800 bg-[#10110f] px-2 py-1 text-xs text-stone-400">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function MessagesPanel({ currentCase }: { currentCase: DetectiveCase }) {
  return (
    <div className="grid gap-3 p-4 lg:p-6">
      {currentCase.threads.map((message) => (
        <article key={`${message.platform}-${message.time}-${message.author}`} className="rounded-md border border-stone-800 bg-stone-950 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-stone-700 px-2 py-1 text-xs text-stone-400">{message.platform}</span>
              <span className="font-medium text-stone-100">{message.author}</span>
              <span style={monoFont} className="text-xs text-stone-500">
                {message.handle}
              </span>
            </div>
            <span style={monoFont} className="text-xs text-stone-500">
              {message.time}
            </span>
          </div>
          <p className={cx("text-sm leading-6", message.deleted ? "text-rose-100 line-through decoration-rose-400/70" : "text-stone-300")}>
            {message.text}
          </p>
        </article>
      ))}
    </div>
  );
}

function TimelinePanel({ currentCase }: { currentCase: DetectiveCase }) {
  return (
    <div className="p-4 lg:p-6">
      <div className="grid gap-3">
        {currentCase.timeline.map((item) => (
          <div key={`${item.time}-${item.source}`} className="grid gap-3 rounded-md border border-stone-800 bg-stone-950 p-4 sm:grid-cols-[90px_120px_minmax(0,1fr)_110px] sm:items-center">
            <div style={monoFont} className="text-lg text-stone-100">
              {item.time}
            </div>
            <div className="text-xs uppercase text-stone-500">{item.source}</div>
            <div className="text-sm leading-6 text-stone-300">{item.event}</div>
            <div
              className={cx(
                "justify-self-start rounded-md border px-2 py-1 text-xs uppercase sm:justify-self-end",
                item.confidence === "high" && "border-emerald-300/40 text-emerald-200",
                item.confidence === "medium" && "border-amber-300/40 text-amber-100",
                item.confidence === "low" && "border-rose-300/40 text-rose-100",
              )}
            >
              {item.confidence === "high" ? "высокая" : item.confidence === "medium" ? "средняя" : "низкая"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetworkPanel({
  currentCase,
  selectedSuspect,
  selectedSuspectId,
  pressure,
  visibleEvidence,
  theory,
  theoryResult,
  onSelectSuspect,
  onSetTheory,
  onToggleTheoryEvidence,
  onSubmitTheory,
}: {
  currentCase: DetectiveCase;
  selectedSuspect: Suspect;
  selectedSuspectId: string;
  pressure: Record<string, number>;
  visibleEvidence: Evidence[];
  theory: TheoryState;
  theoryResult: string;
  onSelectSuspect: (id: string) => void;
  onSetTheory: (theory: TheoryState | ((current: TheoryState) => TheoryState)) => void;
  onToggleTheoryEvidence: (id: string) => void;
  onSubmitTheory: () => void;
}) {
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="rounded-md border border-stone-800 bg-stone-950 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-200">
            <GitBranch className="h-4 w-4" />
            Карта подозреваемых
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {currentCase.suspects.map((suspect) => (
              <button
                key={suspect.id}
                type="button"
                onClick={() => onSelectSuspect(suspect.id)}
                className={cx(
                  "rounded-md border p-4 text-left",
                  selectedSuspectId === suspect.id ? colorClasses[suspect.color] : "border-stone-800 bg-[#10110f] text-stone-300 hover:border-stone-600",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{suspect.name}</div>
                    <div style={monoFont} className="text-xs text-stone-500">
                      {suspect.username}
                    </div>
                  </div>
                  <div style={monoFont} className="text-xs text-stone-500">
                    стресс {pressure[suspect.id] ?? suspect.stress}%
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded bg-stone-900">
                  <div className="h-full rounded bg-rose-300" style={{ width: `${pressure[suspect.id] ?? suspect.stress}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-stone-800 bg-stone-950 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md border border-stone-700 bg-black/30 font-semibold">
              {selectedSuspect.avatar}
            </div>
            <div>
              <div className="font-semibold">{selectedSuspect.name}</div>
              <div style={monoFont} className="text-xs text-stone-500">
                {selectedSuspect.username}
              </div>
            </div>
          </div>
          <dl className="grid gap-3 text-sm leading-6">
            <div>
              <dt className="text-xs uppercase text-stone-500">Связь</dt>
              <dd className="text-stone-300">{selectedSuspect.relation}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-stone-500">Видимый мотив</dt>
              <dd className="text-stone-300">{selectedSuspect.publicMotive}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-stone-500">Поведение</dt>
              <dd className="text-stone-300">{selectedSuspect.tone}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="rounded-md border border-stone-800 bg-stone-950 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
          <CheckCircle2 className="h-4 w-4" />
          Собрать версию
        </div>
        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <select
            value={theory.suspect}
            onChange={(event) => onSetTheory((current) => ({ ...current, suspect: event.target.value }))}
            className="min-h-11 rounded-md border border-stone-800 bg-[#10110f] px-3 text-sm outline-none focus:border-stone-400"
          >
            {currentCase.suspects.map((suspect) => (
              <option key={suspect.id} value={suspect.id}>
                {suspect.name}
              </option>
            ))}
          </select>
          <input
            value={theory.motive}
            onChange={(event) => onSetTheory((current) => ({ ...current, motive: event.target.value }))}
            className="min-h-11 rounded-md border border-stone-800 bg-[#10110f] px-3 text-sm outline-none focus:border-stone-400"
            placeholder="мотив и связка событий"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleEvidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleTheoryEvidence(item.id)}
              className={cx(
                "rounded-md border px-3 py-2 text-xs transition",
                theory.proof.includes(item.id)
                  ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100"
                  : "border-stone-800 bg-[#10110f] text-stone-400 hover:border-stone-600",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onSubmitTheory}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-100 bg-stone-100 px-4 text-sm font-medium text-stone-950 hover:bg-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            Проверить версию
          </button>
          {theoryResult && <p className="text-sm leading-6 text-stone-300">{theoryResult}</p>}
        </div>
      </section>
    </div>
  );
}
