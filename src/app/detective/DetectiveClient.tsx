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
  ListChecks,
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
  fontFamily: 'var(--font-geist-sans), "Roboto Flex", Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  letterSpacing: 0,
};

const monoFont: CSSProperties = {
  fontFamily: 'var(--font-geist-mono), "Cascadia Code", "JetBrains Mono", "SFMono-Regular", Consolas, monospace',
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

const starterActions: Record<DetectiveCaseId, Array<{ label: string; hint: string }>> = {
  habarhub: [
    { label: "Посмотреть последние минуты стрима", hint: "архив стрима" },
    { label: "Проверить донаты", hint: "лог донатов" },
    { label: "Найти удаленные сообщения", hint: "восстановить dm" },
  ],
  keanu: [
    { label: "Проверить само видео", hint: "метаданные кадра" },
    { label: "Посмотреть страницу сбора", hint: "кошелек фонда" },
    { label: "Найти, откуда пришла ссылка", hint: "cdn лог" },
  ],
  donk: [
    { label: "Проверить архив с демками", hint: "hash dem" },
    { label: "Найти путь файла", hint: "steam trade" },
    { label: "Проверить вредный лаунчер", hint: "scan launcher" },
  ],
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
  const queryTokens = normalized
    .split(/[\s,.;:()[\]{}"'`/\\|+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 || token === "dm");

  return currentCase.evidence.find((item) => {
    if (unlocked.includes(item.id)) return false;

    const directHint = item.unlockHints?.some((hint) => normalized.includes(normalize(hint)));
    if (directHint) return true;

    const searchableText = normalize([item.title, item.kind, item.source, item.summary, item.body, ...item.tags].join(" "));
    return queryTokens.some((token) => searchableText.includes(token));
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
    return currentCase.evidence.filter((item) => unlocked.includes(item.id));
  }, [currentCase, unlocked]);

  const lockedEvidence = useMemo(() => {
    if (!currentCase) return [];
    return currentCase.evidence.filter((item) => !unlocked.includes(item.id));
  }, [currentCase, unlocked]);

  const selectedEvidence = visibleEvidence.find((item) => item.id === selectedEvidenceId) ?? visibleEvidence[0];
  const selectedSuspect = currentCase?.suspects.find((item) => item.id === selectedSuspectId);
  const progress = currentCase ? Math.round((visibleEvidence.length / currentCase.evidence.length) * 100) : 0;

  function openCase(nextCase: DetectiveCase) {
    setCaseId(nextCase.id);
    setActiveTab("summary");
    setUnlocked(nextCase.initialUnlocked);
    setSelectedEvidenceId("");
    setSelectedSuspectId("");
    setTerminalInput("");
    setTerminalLog([
      `Дело открыто: ${nextCase.title}`,
      "Сначала доступно только описание. Выберите первый след в блоке справа.",
    ]);
    setChat(buildInitialChat(nextCase));
    setPressure(buildPressure(nextCase));
    setQuestion("");
    setTheory({
      suspect: "",
      motive: "",
      proof: [],
    });
    setTheoryResult("");
  }

  function revealEvidence(item: Evidence, reason: string) {
    setUnlocked((current) => (current.includes(item.id) ? current : [...current, item.id]));
    setSelectedEvidenceId(item.id);
    if (!selectedSuspectId && currentCase) {
      setSelectedSuspectId(currentCase.starterSuspectId);
      setTheory((current) => ({ ...current, suspect: current.suspect || currentCase.starterSuspectId }));
    }
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

  function runQuickSearch(query: string) {
    if (!currentCase) return;

    const found = matchTerminalEvidence(currentCase, query, unlocked);
    setTerminalInput("");

    if (found) {
      revealEvidence(found, "Вы проверили первый понятный след.");
      return;
    }

    setTerminalLog((current) => [
      `Пока ничего не найдено: ${query}`,
      "Попробуйте выбрать одну из кнопок ниже или ввести название источника: стрим, донаты, Discord, видео, кошелек.",
      ...current,
    ].slice(0, 5));
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
    <main style={detectiveFont} className="min-h-screen bg-[#f4f4f2] text-[#20251f]">
      <header className="border-b border-[#dedbd2] bg-[#fbfbf8]">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCaseId(null)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#cfcac0] bg-white text-[#20251f] transition hover:border-[#8b867b]"
              aria-label="Вернуться к выбору дел"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div style={monoFont} className="text-xs uppercase text-[#777164]">
                закрытый раздел / /detective
              </div>
              <h1 className="truncate text-2xl font-black text-[#20251f] sm:text-3xl">{currentCase.menuTitle}</h1>
              <p className="truncate text-sm text-[#686256]">{currentCase.connectedTo}</p>
            </div>
          </div>

          <div className="min-w-[260px] rounded-md border border-[#d8d5ca] bg-white p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[#3c413a]">Открыто улик</span>
              <span style={monoFont} className="font-semibold text-[#20251f]">
                {visibleEvidence.length}/{currentCase.evidence.length}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#e9e6dc]">
              <div className="h-full rounded-full bg-[#6f7f4e]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1360px] gap-5 px-4 py-5 sm:px-6">
        <InvestigationSteps foundCount={visibleEvidence.length} suspectSelected={Boolean(selectedSuspect)} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-md border border-[#dedbd2] bg-white shadow-sm">
            <nav className="grid border-b border-[#e5e1d8] bg-[#fbfbf8] p-2 sm:grid-cols-4">
              {[
                { id: "summary" as TabId, label: "Описание", icon: FileText },
                { id: "evidence" as TabId, label: "Улики", icon: Fingerprint },
                { id: "network" as TabId, label: "Люди", icon: MessageSquare },
                { id: "timeline" as TabId, label: "Время", icon: Clock },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cx(
                      "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                      activeTab === tab.id ? "bg-[#20251f] text-white" : "text-[#686256] hover:bg-[#eeeae1] hover:text-[#20251f]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {activeTab === "summary" && (
              <SummaryPanel
                currentCase={currentCase}
                foundCount={visibleEvidence.length}
                onOpenSuspect={(id) => {
                  setSelectedSuspectId(id);
                  setTheory((current) => ({ ...current, suspect: current.suspect || id }));
                  setActiveTab("network");
                }}
              />
            )}

            {activeTab === "evidence" && (
              <SimpleEvidencePanel
                currentCase={currentCase}
                selectedEvidence={selectedEvidence}
                visibleEvidence={visibleEvidence}
                unlocked={unlocked}
                onSelectEvidence={setSelectedEvidenceId}
                onSearch={runQuickSearch}
              />
            )}

            {activeTab === "network" && (
              <SimplePeoplePanel
                currentCase={currentCase}
                selectedSuspect={selectedSuspect}
                selectedSuspectId={selectedSuspectId}
                pressure={pressure}
                chat={chat}
                question={question}
                visibleEvidence={visibleEvidence}
                onSelectSuspect={(id) => {
                  setSelectedSuspectId(id);
                  setTheory((current) => ({ ...current, suspect: current.suspect || id }));
                }}
                onQuestionChange={setQuestion}
                onSubmitQuestion={sendQuestion}
              />
            )}

            {activeTab === "timeline" && (
              visibleEvidence.length > 0 ? (
                <TimelinePanel currentCase={currentCase} />
              ) : (
                <LockedStartPanel title="Линия времени появится после первой улики" text="Сначала откройте любой первый след. После этого здесь будет проще сравнить минуты, действия и алиби." />
              )
            )}
          </section>

          <aside className="space-y-4">
            <NextActionCard
              currentCase={currentCase}
              visibleEvidence={visibleEvidence}
              lockedCount={lockedEvidence.length}
              terminalInput={terminalInput}
              terminalLog={terminalLog}
              onInputChange={setTerminalInput}
              onRunTerminal={runTerminal}
              onQuickSearch={runQuickSearch}
              onGoEvidence={() => setActiveTab("evidence")}
              onGoPeople={() => setActiveTab("network")}
            />

            <section className="rounded-md border border-[#dedbd2] bg-white p-4 shadow-sm">
              <div className="mb-2 text-sm font-bold text-[#20251f]">Как играть</div>
              <ol className="grid gap-2 text-sm leading-6 text-[#5d584f]">
                <li>1. Прочитайте, что случилось.</li>
                <li>2. Нажмите один из первых следов.</li>
                <li>3. Откройте улику и проверьте, кому она противоречит.</li>
                <li>4. Переходите к людям и задавайте вопросы по конкретным фактам.</li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InvestigationSteps({ foundCount, suspectSelected }: { foundCount: number; suspectSelected: boolean }) {
  const steps = [
    { title: "Понять событие", detail: "Прочитать короткое описание.", done: true },
    { title: "Открыть первую улику", detail: "Нажать один понятный след.", done: foundCount > 0 },
    { title: "Проверить людей", detail: "Сравнить слова с фактами.", done: suspectSelected },
    { title: "Собрать версию", detail: "Выбрать мотив и доказательства.", done: foundCount >= 3 },
  ];

  return (
    <section className="grid gap-2 md:grid-cols-4">
      {steps.map((step, index) => (
        <article
          key={step.title}
          className={cx(
            "rounded-md border p-4 shadow-sm",
            step.done ? "border-[#6f7f4e]/35 bg-[#eef2e8]" : "border-[#dedbd2] bg-white",
          )}
        >
          <div className="mb-3 flex items-center gap-3">
            <span
              style={monoFont}
              className={cx(
                "grid h-8 w-8 place-items-center rounded-full text-xs font-bold",
                step.done ? "bg-[#6f7f4e] text-white" : "bg-[#e9e6dc] text-[#5d584f]",
              )}
            >
              {index + 1}
            </span>
            <div className="font-bold text-[#20251f]">{step.title}</div>
          </div>
          <p className="text-sm leading-5 text-[#686256]">{step.detail}</p>
        </article>
      ))}
    </section>
  );
}

function NextActionCard({
  currentCase,
  visibleEvidence,
  lockedCount,
  terminalInput,
  terminalLog,
  onInputChange,
  onRunTerminal,
  onQuickSearch,
  onGoEvidence,
  onGoPeople,
}: {
  currentCase: DetectiveCase;
  visibleEvidence: Evidence[];
  lockedCount: number;
  terminalInput: string;
  terminalLog: string[];
  onInputChange: (value: string) => void;
  onRunTerminal: (event: FormEvent<HTMLFormElement>) => void;
  onQuickSearch: (hint: string) => void;
  onGoEvidence: () => void;
  onGoPeople: () => void;
}) {
  const hasEvidence = visibleEvidence.length > 0;

  return (
    <section className="rounded-md border border-[#dedbd2] bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-bold text-[#20251f]">Что сделать сейчас</div>
      <p className="text-sm leading-6 text-[#686256]">
        {hasEvidence
          ? "У вас уже есть первые материалы. Откройте улику или переходите к людям, чтобы проверить алиби."
          : "Начните с одного простого действия. Никаких команд знать не нужно."}
      </p>

      {!hasEvidence && (
        <div className="mt-4 grid gap-2">
          {starterActions[currentCase.id].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onQuickSearch(action.hint)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[#d8d5ca] bg-[#fbfbf8] px-3 text-left text-sm font-semibold text-[#20251f] transition hover:border-[#9f9a8e] hover:bg-[#f1efe7]"
            >
              <span>{action.label}</span>
              <Search className="h-4 w-4 text-[#6f7f4e]" />
            </button>
          ))}
        </div>
      )}

      {hasEvidence && (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onGoEvidence}
            className="min-h-11 rounded-md bg-[#20251f] px-4 text-sm font-semibold text-white transition hover:bg-[#343b33]"
          >
            Открыть найденные улики
          </button>
          <button
            type="button"
            onClick={onGoPeople}
            className="min-h-11 rounded-md border border-[#d8d5ca] bg-white px-4 text-sm font-semibold text-[#20251f] transition hover:bg-[#f1efe7]"
          >
            Проверить людей
          </button>
        </div>
      )}

      <form onSubmit={onRunTerminal} className="mt-4 flex gap-2">
        <input
          value={terminalInput}
          onChange={(event) => onInputChange(event.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-[#d8d5ca] bg-[#fbfbf8] px-3 text-sm text-[#20251f] outline-none focus:border-[#6f7f4e]"
          placeholder="или введите свой поиск"
        />
        <button
          type="submit"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#6f7f4e] text-white transition hover:bg-[#5d6b42]"
          aria-label="Искать"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-4 rounded-md bg-[#f6f5f0] p-3 text-sm text-[#686256]">
        <div className="font-semibold text-[#20251f]">Состояние дела</div>
        <div className="mt-1">Найдено: {visibleEvidence.length}</div>
        <div>Еще скрыто: {lockedCount}</div>
      </div>

      {terminalLog.length > 0 && (
        <div className="mt-3 grid gap-2 text-xs leading-5 text-[#686256]">
          {terminalLog.slice(0, 2).map((line, index) => (
            <div key={`${line}-${index}`} className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-2">
              {line}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SimpleEvidencePanel({
  currentCase,
  selectedEvidence,
  visibleEvidence,
  unlocked,
  onSelectEvidence,
  onSearch,
}: {
  currentCase: DetectiveCase;
  selectedEvidence?: Evidence;
  visibleEvidence: Evidence[];
  unlocked: string[];
  onSelectEvidence: (id: string) => void;
  onSearch: (hint: string) => void;
}) {
  if (!selectedEvidence) {
    return <EmptyEvidencePanel currentCase={currentCase} onUseTip={onSearch} />;
  }

  return (
    <div className="grid min-h-[640px] gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="border-b border-[#e5e1d8] bg-[#fbfbf8] lg:border-b-0 lg:border-r">
        <div className="border-b border-[#e5e1d8] p-4">
          <div className="text-sm font-bold text-[#20251f]">Найденные улики</div>
          <p className="mt-1 text-sm leading-5 text-[#686256]">Открывайте по одной и смотрите, кому она противоречит.</p>
        </div>
        {visibleEvidence.map((item) => {
          const Icon = kindIcon[item.kind];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectEvidence(item.id)}
              className={cx(
                "block w-full border-b border-[#e5e1d8] p-4 text-left transition",
                selectedEvidence.id === item.id ? "bg-[#eef2e8]" : "bg-white hover:bg-[#f6f5f0]",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[#20251f]">
                <Icon className="h-4 w-4 text-[#6f7f4e]" />
                <span>{item.title}</span>
              </div>
              <p className="mt-2 text-sm leading-5 text-[#686256]">{item.summary}</p>
            </button>
          );
        })}
      </div>

      <SimpleEvidenceDetail item={selectedEvidence} recovered={selectedEvidence.status === "locked" && unlocked.includes(selectedEvidence.id)} />
    </div>
  );
}

function SimpleEvidenceDetail({ item, recovered }: { item: Evidence; recovered: boolean }) {
  const Icon = kindIcon[item.kind];
  const displayStatus = recovered ? "recovered" : item.status;

  return (
    <article className="p-5 lg:p-7">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#e5e1d8] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#686256]">
            <Icon className="h-4 w-4" />
            {kindLabel[item.kind]} / {item.source}
          </div>
          <h2 className="text-2xl font-black text-[#20251f]">{item.title}</h2>
        </div>
        <span className="w-fit rounded-md bg-[#f1efe7] px-3 py-2 text-xs font-semibold uppercase text-[#5d584f]">
          {statusLabel[displayStatus]}
        </span>
      </div>

      <div className="grid gap-4">
        <section className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4">
          <div className="mb-2 text-sm font-bold text-[#20251f]">Что в улике</div>
          <p className="leading-7 text-[#4e4a42]">{item.body}</p>
        </section>
        <section className="rounded-md border border-[#dfc8bc] bg-[#fbf1ed] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#7c3f2e]">
            <AlertTriangle className="h-4 w-4" />
            На что обратить внимание
          </div>
          <p className="leading-7 text-[#5c3b32]">{item.contradiction}</p>
        </section>
      </div>
    </article>
  );
}

function SimplePeoplePanel({
  currentCase,
  selectedSuspect,
  selectedSuspectId,
  pressure,
  chat,
  question,
  visibleEvidence,
  onSelectSuspect,
  onQuestionChange,
  onSubmitQuestion,
}: {
  currentCase: DetectiveCase;
  selectedSuspect?: Suspect;
  selectedSuspectId: string;
  pressure: Record<string, number>;
  chat: Record<string, NpcMessage[]>;
  question: string;
  visibleEvidence: Evidence[];
  onSelectSuspect: (id: string) => void;
  onQuestionChange: (value: string) => void;
  onSubmitQuestion: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (visibleEvidence.length === 0) {
    return (
      <LockedStartPanel
        title="Люди откроются после первой улики"
        text="Так проще: сначала факт, потом вопросы. Откройте любой первый след, и здесь появятся подозреваемые."
      />
    );
  }

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
      <section>
        <div className="mb-3 text-sm font-bold text-[#20251f]">Кого проверить</div>
        <div className="grid gap-3 md:grid-cols-2">
          {currentCase.suspects.map((suspect) => (
            <button
              key={suspect.id}
              type="button"
              onClick={() => onSelectSuspect(suspect.id)}
              className={cx(
                "rounded-md border p-4 text-left transition",
                selectedSuspectId === suspect.id ? "border-[#6f7f4e] bg-[#eef2e8]" : "border-[#e5e1d8] bg-[#fbfbf8] hover:bg-[#f6f5f0]",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-[#20251f] text-sm font-bold text-white">
                  {suspect.avatar}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-[#20251f]">{suspect.name}</div>
                  <div style={monoFont} className="truncate text-xs text-[#777164]">
                    {suspect.username}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#5d584f]">{suspect.role}</p>
              <div className="mt-3 text-xs font-semibold uppercase text-[#8b867b]">Что проверить</div>
              <p className="mt-1 text-sm leading-6 text-[#5d584f]">{suspect.alibi}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8]">
        {selectedSuspect ? (
          <>
            <div className="border-b border-[#e5e1d8] p-4">
              <div className="font-bold text-[#20251f]">{selectedSuspect.name}</div>
              <div className="mt-1 text-sm text-[#686256]">{selectedSuspect.publicMotive}</div>
              <div className="mt-3 h-2 rounded-full bg-[#e9e6dc]">
                <div className="h-full rounded-full bg-[#b56f5a]" style={{ width: `${pressure[selectedSuspect.id] ?? selectedSuspect.stress}%` }} />
              </div>
            </div>
            <div className="max-h-[360px] overflow-auto p-4">
              <div className="grid gap-3">
                {(chat[selectedSuspectId] ?? []).map((message, index) => (
                  <div
                    key={`${selectedSuspectId}-${message.time}-${index}`}
                    className={cx(
                      "rounded-md border p-3 text-sm leading-6",
                      message.from === "player" ? "border-[#d8d5ca] bg-white" : "border-[#e5e1d8] bg-[#f6f5f0]",
                    )}
                  >
                    <div style={monoFont} className="mb-1 text-[10px] uppercase text-[#8b867b]">
                      {message.from === "player" ? "детектив" : selectedSuspect.username}
                    </div>
                    {message.text}
                  </div>
                ))}
              </div>
            </div>
            <form onSubmit={onSubmitQuestion} className="border-t border-[#e5e1d8] p-4">
              <textarea
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                className="min-h-24 w-full resize-none rounded-md border border-[#d8d5ca] bg-white p-3 text-sm leading-6 text-[#20251f] outline-none focus:border-[#6f7f4e]"
                placeholder="Спросить по факту из улики"
              />
              <button
                type="submit"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#20251f] px-4 text-sm font-semibold text-white transition hover:bg-[#343b33]"
              >
                <Send className="h-4 w-4" />
                Отправить
              </button>
            </form>
          </>
        ) : (
          <div className="p-4 text-sm leading-6 text-[#686256]">Выберите человека слева, чтобы задать вопросы.</div>
        )}
      </aside>
    </div>
  );
}

function CaseMenu({ onOpenCase }: { onOpenCase: (nextCase: DetectiveCase) => void }) {
  return (
    <main style={detectiveFont} className="min-h-screen bg-[#f4f4f2] text-[#20251f]">
      <section className="mx-auto grid min-h-screen w-full max-w-[1360px] grid-rows-[auto_minmax(0,1fr)_auto] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-md border border-[#dedbd2] bg-white p-5 shadow-sm lg:p-8">
          <div className="inline-flex items-center gap-2 rounded-md border border-[#d8d5ca] bg-[#fbfbf8] px-3 py-2 text-sm text-[#5d584f]">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[#20251f] text-white">
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
            Закрытый раздел. В главное меню сайта не добавлен.
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-none text-[#20251f] sm:text-6xl">Выберите дело</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#5d584f] sm:text-lg">
            Внутри все начинается с короткого описания. Затем вы нажимаете понятный первый след, открываете улики и проверяете людей. Без сложных команд и лишнего шума.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["0% на старте", "3 дела", "улики открываются по шагам", "/detective"].map((item) => (
              <span key={item} className="rounded-md border border-[#dedbd2] bg-[#f6f5f0] px-3 py-2 text-sm font-semibold text-[#5d584f]">
                {item}
              </span>
            ))}
          </div>
        </header>

        <div className="grid content-center gap-4 lg:grid-cols-3">
          {detectiveCases.map((item) => (
            <article
              key={item.id}
              className="group grid min-h-[560px] grid-rows-[180px_auto] overflow-hidden rounded-md border border-[#dedbd2] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <CaseSignalArt currentCase={item} />
              <div className="grid gap-4 p-5">
                <div>
                  <div className="mb-3 inline-flex rounded-md border border-[#d8d5ca] bg-[#fbfbf8] px-3 py-1 text-xs font-bold text-[#5d584f]">
                    {item.connectedTo}
                  </div>
                  <h2 className="text-2xl font-black leading-tight text-[#20251f]">{item.menuTitle}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#5d584f]">{item.description}</p>
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
                  className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#20251f] px-4 text-sm font-bold text-white transition hover:bg-[#343b33]"
                >
                  <FolderOpen className="h-4 w-4" />
                  Открыть дело
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-[#dedbd2] pt-4 text-sm text-[#777164]">
          Доступ напрямую: /detective. Страница закрыта от индексации и не размещена на главной.
        </footer>
      </section>
    </main>
  );
}

function CaseSignalArt({ currentCase }: { currentCase: DetectiveCase }) {
  const label = currentCase.id === "habarhub" ? "HABAR" : currentCase.id === "keanu" ? "K-09" : "D-22";

  return (
    <div className="relative overflow-hidden bg-[#f6f5f0]">
      <svg viewBox="0 0 720 360" className="h-full w-full" role="img" aria-label={`Обложка дела ${currentCase.menuTitle}`}>
        <rect width="720" height="360" fill="#f6f5f0" />
        <path d="M0 72H720M0 144H720M0 216H720M0 288H720M90 0V360M180 0V360M270 0V360M360 0V360M450 0V360M540 0V360M630 0V360" stroke="#dedbd2" strokeWidth="1" />
        <rect x="48" y="42" width="250" height="138" fill="#ffffff" stroke="#d8d5ca" strokeWidth="2" />
        <rect x="430" y="58" width="210" height="128" fill="#ffffff" stroke="#d8d5ca" strokeWidth="2" />
        <path d="M72 244C118 202 142 282 190 238C238 194 276 266 320 224C362 184 404 260 452 218C500 176 544 244 622 206" fill="none" stroke="#6f7f4e" strokeWidth="5" strokeLinecap="round" />
        <path d="M96 86H236M96 118H188M96 150H252" stroke="#20251f" strokeOpacity="0.72" strokeWidth="9" strokeLinecap="round" />
        <path d="M456 96H594M456 132H562M456 164H616" stroke="#b56f5a" strokeOpacity="0.82" strokeWidth="8" strokeLinecap="round" />
        <circle cx="362" cy="112" r="34" fill="none" stroke="#6f7f4e" strokeOpacity="0.75" strokeWidth="3" />
        <path d="M362 78V146M328 112H396" stroke="#6f7f4e" strokeOpacity="0.75" strokeWidth="3" />
        <text x="48" y="316" fill="#20251f" fontSize="44" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700">
          {label}
        </text>
        <text x="48" y="340" fill="#686256" fontSize="18" fontFamily="Segoe UI, Arial, sans-serif">
          расследование
        </text>
      </svg>
    </div>
  );
}

function CaseStatusCards({
  currentCase,
  foundCount,
  totalCount,
  progress,
}: {
  currentCase: DetectiveCase;
  foundCount: number;
  totalCount: number;
  progress: number;
}) {
  return (
    <div className="grid w-full gap-3 md:grid-cols-3 xl:w-[780px]">
      <StatusCard
        accent={currentCase.id}
        label="Найдено улик"
        value={`${foundCount} из ${totalCount}`}
        detail="Материалы, которые уже можно открыть и использовать в версии."
      />
      <StatusCard
        accent={currentCase.id}
        label="Прогресс архива"
        value={`${progress}%`}
        detail="Доля найденных цифровых следов. Финальная правда все равно зависит от связки улик."
      />
      <StatusCard
        accent={currentCase.id}
        label="Сложность дела"
        value={currentCase.difficulty}
        detail="Показывает, сколько ложных следов, допросов и скрытых артефактов будет внутри."
      />
    </div>
  );
}

function StatusCard({
  accent,
  label,
  value,
  detail,
}: {
  accent: DetectiveCaseId;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.06] p-4 text-left">
      <div className="text-xs font-bold uppercase text-[#acdb26]">{label}</div>
      <div className="mt-2 min-w-0 break-words text-2xl font-black leading-tight text-stone-50">{value}</div>
      <p className="mt-2 text-xs leading-5 text-stone-400">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2">
      <div className="text-xs text-stone-500">{label}</div>
      <div style={monoFont} className="text-base text-stone-100">
        {value}
      </div>
    </div>
  );
}

function SmallFact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cx("rounded-md border border-black/10 bg-[#f3f4ef] p-3", wide && "col-span-2")}>
      <div className="text-xs font-bold uppercase text-black/40">{label}</div>
      <div className="mt-1 text-sm font-semibold text-black/80">{value}</div>
    </div>
  );
}

function TaskBoard({ currentCase }: { currentCase: DetectiveCase }) {
  return (
    <section className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[#20251f]">
            <ListChecks className="h-4 w-4" />
            Задачи по делу
          </div>
          <p className="mt-1 text-sm text-[#686256]">Это не квесты с одним путем, а простой чек-лист проверки версии.</p>
        </div>
        <span className="w-fit rounded-md border border-[#d8d5ca] bg-white px-3 py-1 text-xs font-bold text-[#5d584f]">
          {currentCase.tasks.length} задач
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {currentCase.tasks.map((task, index) => (
          <article key={task.title} className="rounded-md border border-[#e5e1d8] bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  style={monoFont}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[#eef2e8] text-xs font-bold text-[#4f6638]"
                >
                  {index + 1}
                </span>
                <h3 className="text-base font-bold leading-6 text-[#20251f]">{task.title}</h3>
              </div>
              <span className="shrink-0 rounded-md border border-[#d8d5ca] px-2 py-1 text-xs text-[#777164]">не начато</span>
            </div>
            <p className="text-sm leading-6 text-[#5d584f]">{task.detail}</p>
            <div style={monoFont} className="mt-3 text-xs uppercase text-[#8b867b]">
              {task.kind}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryPanel({
  currentCase,
  foundCount,
  onOpenSuspect,
}: {
  currentCase: DetectiveCase;
  foundCount: number;
  onOpenSuspect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <section className="rounded-md border border-[#e5e1d8] bg-white p-5 lg:p-7">
        <div style={monoFont} className="mb-4 text-xs font-bold uppercase text-[#8b867b]">
          сначала только вводная
        </div>
        <h2 className="text-3xl font-black leading-tight text-[#20251f] sm:text-4xl">Что произошло</h2>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-[#4e4a42]">{currentCase.whatHappened}</p>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4">
            <div className="mb-2 text-sm font-bold text-[#20251f]">Главный вопрос</div>
            <p className="leading-7 text-[#5d584f]">{currentCase.mainMystery}</p>
          </div>
          <div className="rounded-md border border-[#dfe5d7] bg-[#eef2e8] p-4">
            <div className="mb-2 text-sm font-bold text-[#20251f]">Что нужно сделать</div>
            <p className="leading-7 text-[#4d5b3c]">{currentCase.investigatorGoal}</p>
          </div>
        </div>
      </section>

      <TaskBoard currentCase={currentCase} />

      {foundCount === 0 ? (
        <section className="rounded-md border border-[#dfe5d7] bg-[#eef2e8] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#4f6638]">
            <Lock className="h-4 w-4" />
            Дальше: открыть первый след
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[#4d5b3c]">
            Нажмите одну из кнопок справа в блоке “Что сделать сейчас”. После первой улики появятся люди и конкретные вопросы.
          </p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#20251f]">
                <AlertTriangle className="h-4 w-4 text-[#b56f5a]" />
                Что может сбить с толку
              </div>
              <div className="grid gap-3">
                {currentCase.falseLeads.map((lead) => (
                  <div key={lead} className="border-l border-[#d8d5ca] pl-3 text-sm leading-6 text-[#5d584f]">
                    {lead}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4">
              <div className="mb-3 text-sm font-bold text-[#20251f]">Первые люди</div>
              <p className="text-sm leading-6 text-[#5d584f]">
                Эти профили появляются после первого найденного следа. Проверяйте их алиби через карту связей и канал допроса.
              </p>
            </section>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {currentCase.suspects.map((suspect) => (
              <button
                key={suspect.id}
                type="button"
                onClick={() => onOpenSuspect(suspect.id)}
                className="min-h-52 rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4 text-left transition hover:bg-[#f6f5f0]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-[#20251f] text-sm font-bold text-white">
                    {suspect.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-[#20251f]">{suspect.name}</div>
                    <div style={monoFont} className="truncate text-xs text-[#777164]">
                      {suspect.username}
                    </div>
                  </div>
                </div>
                <div className="text-sm leading-6 text-[#5d584f]">{suspect.role}</div>
                <div className="mt-3 text-xs font-semibold uppercase text-[#8b867b]">Алиби</div>
                <div className="text-sm leading-6 text-[#5d584f]">{suspect.alibi}</div>
              </button>
            ))}
          </div>

          <section className="rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4">
            <div className="mb-3 text-sm font-bold text-[#20251f]">Возможные итоги</div>
            <div className="grid gap-3 md:grid-cols-3">
              {currentCase.endings.map((ending) => (
                <div key={ending} className="rounded-md border border-[#e5e1d8] bg-white p-3 text-sm leading-6 text-[#5d584f]">
                  {ending}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyEvidencePanel({ currentCase, onUseTip }: { currentCase: DetectiveCase; onUseTip: (tip: string) => void }) {
  return (
    <div className="grid min-h-[560px] place-items-center p-4 lg:p-6">
      <section className="w-full max-w-3xl rounded-md border border-[#e5e1d8] bg-white p-6 lg:p-8">
        <div style={monoFont} className="mb-4 text-xs font-bold uppercase text-[#8b867b]">
          0 / {currentCase.evidence.length} улик
        </div>
        <h2 className="text-3xl font-black leading-tight text-[#20251f]">Улик пока нет</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#5d584f]">
          Это нормально. Начните с одного простого действия ниже, и первая улика откроется автоматически.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {starterActions[currentCase.id].map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onUseTip(action.hint)}
              className="min-h-12 rounded-md border border-[#d8d5ca] bg-[#fbfbf8] px-4 text-sm font-bold text-[#20251f] transition hover:bg-[#eef2e8]"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function LockedStartPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-[420px] place-items-center p-4 lg:p-6">
      <section className="w-full max-w-2xl rounded-md border border-[#e5e1d8] bg-white p-6">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-[#eef2e8] text-[#4f6638]">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-black text-[#20251f]">{title}</h2>
        <p className="mt-3 text-base leading-7 text-[#5d584f]">{text}</p>
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
          <div key={`${item.time}-${item.source}`} className="grid gap-3 rounded-md border border-[#e5e1d8] bg-[#fbfbf8] p-4 sm:grid-cols-[90px_120px_minmax(0,1fr)_110px] sm:items-center">
            <div style={monoFont} className="text-lg font-semibold text-[#20251f]">
              {item.time}
            </div>
            <div className="text-xs font-semibold uppercase text-[#8b867b]">{item.source}</div>
            <div className="text-sm leading-6 text-[#5d584f]">{item.event}</div>
            <div
              className={cx(
                "justify-self-start rounded-md border px-2 py-1 text-xs uppercase sm:justify-self-end",
                item.confidence === "high" && "border-[#cdd8c1] bg-[#eef2e8] text-[#4f6638]",
                item.confidence === "medium" && "border-[#e5dcc5] bg-[#fbf6e8] text-[#6f5b2e]",
                item.confidence === "low" && "border-[#dfc8bc] bg-[#fbf1ed] text-[#7c3f2e]",
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
