import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { createLibrary } from "@agentable-ui/lang";
import { Renderer } from "@agentable-ui/genui";
import { uiCatalog } from "@agentable-ui/ui";
import { Flashcards, Quiz, Segmented, formatNumber, motionCatalog, parseNumber } from "../src/index.js";

afterEach(cleanup);

test("motionCatalog keeps every ui entry and adds the motion components", () => {
  for (const name of Object.keys(uiCatalog)) expect(motionCatalog).toHaveProperty(name);
  for (const name of ["Device", "Flashcards", "Quiz", "Lesson", "Rings", "Ranking", "HoloCard", "Carousel", "Accordion", "Segmented", "Compare", "Terminal", "Headline"]) expect(motionCatalog).toHaveProperty(name);
  // Schemas and events pass through untouched.
  expect(motionCatalog.Button.events).toEqual(uiCatalog.Button.events);
  expect(motionCatalog.Card.childrenProp).toBe("children");
});

test("the language accepts programs that use motion components", () => {
  const lib = createLibrary(motionCatalog);
  const out = lib.parse(
    [
      "root = Device(\"phone\", [deck])",
      'deck = Flashcards([{front: "2+2", back: "4"}], title: "Math")',
    ].join("\n"),
  );
  expect(out.errors.filter((e) => e.severity === "error")).toEqual([]);
  expect(out.root).toMatchObject({ component: "Device", props: { kind: "phone" }, children: [{ component: "Flashcards" }] });
  expect(lib.prompt()).toContain("Flashcards(");
});

test("Renderer draws a streamed motion program", async () => {
  const program = 'root = Stack([h, q])\nh = Headline("Learn fast", highlight: ["fast"])\nq = Quiz([{question: "Capital of France?", choices: ["Paris", "Rome"], answer: 0}])\n';
  const view = render(<Renderer components={motionCatalog} response={program} />);
  expect(await view.findByText("Capital of France?")).toBeTruthy();
  expect(view.getByRole("heading", { name: "Learn fast" })).toBeTruthy();
});

test("Quiz marks the answer and reports it", async () => {
  const onAnswer = vi.fn();
  const view = render(<Quiz questions={[{ question: "1+1?", choices: ["2", "3"], answer: 0, explain: "Basic sums." }]} onAnswer={onAnswer} />);
  fireEvent.click(view.getByRole("button", { name: /3/ }));
  expect(onAnswer).toHaveBeenCalledWith({ index: 0, choice: "3", correct: false });
  expect(await view.findByText(/Not quite/)).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "See results" }));
  expect(await view.findByText("Worth another go.")).toBeTruthy();
});

test("Flashcards flips with the keyboard and grades with buttons", async () => {
  const onGrade = vi.fn();
  const view = render(<Flashcards cards={[{ front: "Hola", back: "Hello" }]} onGrade={onGrade} />);
  const deck = view.getByRole("region", { name: "Flashcards" });
  fireEvent.keyDown(deck, { key: " " });
  fireEvent.click(view.getByRole("button", { name: /Got it/ }));
  await waitFor(() => expect(onGrade).toHaveBeenCalledWith({ index: 0, card: { front: "Hola", back: "Hello" }, known: true }), { timeout: 3000 });
  expect(await view.findByText("Deck complete")).toBeTruthy();
});

test("Segmented is a radio group that reports changes", () => {
  const onChange = vi.fn();
  const view = render(<Segmented label="Range" options={["Week", "Month"]} onChange={onChange} />);
  fireEvent.click(view.getByRole("radio", { name: "Month" }));
  expect(onChange).toHaveBeenCalledWith("Month");
  expect(view.getByRole("radio", { name: "Month" }).getAttribute("aria-checked")).toBe("true");
});

test("numbers keep their formatting while they tick", () => {
  expect(parseNumber("$48.2k")).toMatchObject({ pre: "$", n: 48.2, post: "k", decimals: 1 });
  expect(parseNumber("no number")).toBeNull();
  expect(formatNumber(12345.6, 1, true)).toBe("12,345.6");
});
