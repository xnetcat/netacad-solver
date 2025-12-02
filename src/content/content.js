import browser from "webextension-polyfill";
import { deepHtmlSearch, deepHtmlFindByTextContent } from "./domHelper";

console.log("[NetAcad Solver] Content script loaded");

let isSuspendRunning = false;
let isInitiated = false;
const components = [];
let questions = [];
const componentUrls = [];
let iteration = 0;
let totalQuestionsExpected = 0; // total count across the module/test (from API/DOM)
let overallSolvedCount = 0; // progress across pages
let startedByGui = false; // set only when popup triggers start
let lastActiveQuestion = null; // tracks visible question number/index

// Auto-solver state
let isAutoSolving = false;
let autoSolveIndex = 0;
let autoSolveSpeed = 1000; // milliseconds between questions

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[NetAcad Solver] Message received:", request);
  const isTopFrame = window === window.top;

  // Handle componentsUrl from background
  if (
    request?.componentsUrl &&
    typeof request.componentsUrl === "string" &&
    !componentUrls.includes(request.componentsUrl)
  ) {
    if (!isTopFrame) return; // process only in top frame
    console.log("[NetAcad Solver] New components URL:", request.componentsUrl);
    componentUrls.push(request.componentsUrl);
    setComponents(request.componentsUrl)
      .then(() => {
        // try to fetch total questions from API/DOM
        setTotalQuestions(request.componentsUrl);
        suspendMain();
      })
      .catch((e) =>
        console.error("[NetAcad Solver] Error handling componentsUrl:", e)
      );
    // No response needed for background
    return; // or undefined
  }

  // Handle popup messages
  try {
    if (request.action === "getStatus") {
      if (!isTopFrame) return; // respond only from top frame
      console.log("[NetAcad Solver] getStatus requested");
      const status = {
        questionCount: totalQuestionsExpected || questions.length,
        isAutoSolving: isAutoSolving,
        currentQuestion: overallSolvedCount,
        activeQuestion:
          getQuestionNumberFromTitle() || getActiveBlockIndex() || 0,
        remaining: Math.max(
          0,
          (totalQuestionsExpected || questions.length) - overallSolvedCount
        ),
        unanswered: getUnansweredCount(),
      };
      console.log("[NetAcad Solver] Sending status:", status);
      sendResponse(status);
      return true;
    } else if (request.action === "startAutoSolve") {
      if (!isTopFrame) return; // handle only in top frame
      console.log(
        "[NetAcad Solver] Starting auto-solve with speed:",
        request.speed
      );

      if (request.speed !== undefined) {
        const delays = [3000, 2000, 1000, 500, 200];
        autoSolveSpeed = delays[request.speed - 1] || 1000;
        console.log("[NetAcad Solver] Speed set to:", autoSolveSpeed, "ms");
      }

      startAutoSolve();
      sendResponse({ success: true, questionCount: questions.length });
      return true;
    } else if (request.action === "stopAutoSolve") {
      if (!isTopFrame) return; // handle only in top frame
      console.log("[NetAcad Solver] Stopping auto-solve");
      stopAutoSolve();
      sendResponse({ success: true });
      return true;
    } else if (request.action === "refresh") {
      if (!isTopFrame) return; // handle only in top frame
      console.log("[NetAcad Solver] Refresh requested");
      sendResponse({ success: true, questionCount: questions.length });
      return true;
    }
  } catch (error) {
    console.error("[NetAcad Solver] Error handling message:", error);
    sendResponse({ success: false, error: error.message });
    return true;
  }

  // Not handled
  return null;
});

const setComponents = async (url) => {
  console.log("[NetAcad Solver] Fetching components from:", url);

  const getTextContentOfText = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    return doc.body.textContent;
  };

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.log("[NetAcad Solver] Fetch failed:", res.status);
      return;
    }

    let json = await res.json();
    const newComponents = json
      .filter((component) => component._items)
      .filter(
        (component) => !components.map((c) => c._id).includes(component._id)
      )
      .map((component) => {
        component.body = getTextContentOfText(component.body);
        return component;
      });

    components.push(...newComponents);
    console.log(
      "[NetAcad Solver] Added",
      newComponents.length,
      "components. Total:",
      components.length
    );
  } catch (e) {
    console.error("[NetAcad Solver] Error fetching components:", e);
  }
};

const setQuestionSections = async () => {
  let isAtLeaseOneSet = false;

  for (const component of components) {
    const questionDiv = deepHtmlSearch(
      document,
      `.${CSS.escape(component._id)}`
    );

    if (questionDiv) {
      isAtLeaseOneSet = true;
      let questionType = "basic";

      if (component._items[0].text && component._items[0]._options) {
        questionType = "dropdownSelect";
      } else if (component._items[0].question && component._items[0].answer) {
        questionType = "match";
      } else if (
        component._items[0]._graphic?.alt &&
        component._items[0]._graphic?.src
      ) {
        questionType = "yesNo";
      } else if (component._items[0].id && component._items[0]._options?.text) {
        questionType = "openTextInput";
      } else if (
        component._items[0].preText &&
        component._items[0].postText &&
        component._items[0]._options?.[0]?.text
      ) {
        questionType = "fillBlanks";
      } else if (
        component._items[0]._options?.[0].text &&
        typeof component._items[0]._options?.[0]._isCorrect === "boolean"
      ) {
        questionType = "tableDropdown";
      }

      questions.push({
        questionDiv,
        id: component._id,
        answersLength: component._items.length,
        questionType,
        items: component._items,
      });
    }
  }

  if (!isAtLeaseOneSet) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await setQuestionSections();
  }
};

const findQuestionElement = (document) => {
  for (const component of components) {
    const questionElement = deepHtmlFindByTextContent(document, component.body);

    if (questionElement) {
      return questionElement;
    }
  }
};

const findAnswerInputsBasic = (
  document,
  questionId,
  answersLength,
  inputs = []
) => {
  for (let i = 0; i < answersLength; i++) {
    const input = deepHtmlSearch(
      document,
      `#${CSS.escape(questionId)}-${i}-input`
    );
    const label = deepHtmlSearch(
      document,
      `#${CSS.escape(questionId)}-${i}-label`
    );

    if (input) {
      inputs.push({ input, label });

      if (inputs.length === answersLength) {
        return inputs;
      }
    }
  }
};

const findAnswerInputsMatch = (document, answersLength, buttons = []) => {
  for (let i = 0; i < answersLength; i++) {
    const answerInputs = deepHtmlSearch(document, `[data-id="${i}"]`, false, 2);

    if (answerInputs) {
      buttons.push(answerInputs);

      if (buttons.length === answersLength) {
        return buttons;
      }
    }
  }
};

const setQuestionElements = () => {
  questions.map((question) => {
    if (question.questionType === "basic") {
      question.questionElement = findQuestionElement(question.questionDiv);
      question.inputs =
        findAnswerInputsBasic(
          question.questionDiv,
          question.id,
          question.answersLength
        ) || [];
    } else if (question.questionType === "match") {
      question.questionElement = findQuestionElement(question.questionDiv);
      question.inputs =
        findAnswerInputsMatch(question.questionDiv, question.answersLength) ||
        [];
    } else if (question.questionType === "dropdownSelect") {
      // Handled in solveQuestion
    } else if (question.questionType === "yesNo") {
      // Handled in solveQuestion
    } else if (question.questionType === "openTextInput") {
      // Handled in solveQuestion
    } else if (question.questionType === "fillBlanks") {
      // Handled in solveQuestion
    } else if (question.questionType === "tableDropdown") {
      // Handled in solveQuestion
    }

    return question;
  });
};

const initYeNoQuestions = (question) => {
  const currentIteration = iteration;
  const questionElement = deepHtmlSearch(question.questionDiv, `.img_question`);

  if (!questionElement) return;

  questionElement.parentElement?.addEventListener("click", (e) => {
    if (currentIteration !== iteration) return;

    const questionElement = deepHtmlSearch(e.target, `.img_question`);

    for (const item of question.items) {
      if (questionElement.alt === item._graphic.alt) {
        if (item._shouldBeSelected) {
          const yesButton = deepHtmlSearch(
            question.questionDiv,
            `.user_selects_yes`
          );
          yesButton.click();
        } else {
          const noButton = deepHtmlSearch(
            question.questionDiv,
            `.user_selects_no`
          );
          noButton.click();
        }
      }
    }
  });

  const yesButton = deepHtmlSearch(question.questionDiv, `.user_selects_yes`);
  const noButton = deepHtmlSearch(question.questionDiv, `.user_selects_no`);

  yesButton?.addEventListener("mouseover", (e) => {
    if (currentIteration !== iteration) return;
    if (e.ctrlKey) {
      const questionElement = deepHtmlSearch(
        question.questionDiv,
        `.img_question`
      );

      if (questionElement) {
        for (const item of question.items) {
          if (item._graphic.alt === questionElement.alt) {
            if (item._shouldBeSelected) {
              yesButton.click();
            }
            break;
          }
        }
      }
    }
  });

  noButton?.addEventListener("mouseover", (e) => {
    if (currentIteration !== iteration) return;
    if (e.ctrlKey) {
      const questionElement = deepHtmlSearch(
        question.questionDiv,
        `.img_question`
      );

      if (questionElement) {
        for (const item of question.items) {
          if (item._graphic.alt === questionElement.alt) {
            if (!item._shouldBeSelected) {
              noButton.click();
            }
            break;
          }
        }
      }
    }
  });
};

const setOpenTextInputQuestions = (question) => {
  const currentIteration = iteration;

  question.items.forEach((item, i) => {
    const questionElement = deepHtmlSearch(
      question.questionDiv,
      "#" + CSS.escape(`${question.id}-option-${i}`)
    );
    const button = deepHtmlSearch(
      question.questionDiv,
      `.current-item-${i}`,
      true
    );

    questionElement?.addEventListener("click", () => {
      if (currentIteration !== iteration) return;

      setTimeout(() => {
        button.click();
        const currentQuestion = questionElement?.textContent?.trim();
        const position = question.items.find(
          (item) => item._options.text.trim() === currentQuestion
        )?.position?.[0];

        if (position) {
          setTimeout(() => {
            const input = deepHtmlSearch(
              question.questionDiv,
              `[data-target="${position}"]`
            );
            if (input) {
              input?.click();
            } else {
              question.questionDiv.click();
            }
          }, 100);
        }
      }, 100);
    });

    button?.addEventListener("click", () => {
      if (currentIteration !== iteration) return;

      setTimeout(() => {
        const currentQuestion = questionElement?.textContent?.trim();
        const position = question.items.find(
          (item) => item._options.text.trim() === currentQuestion
        )?.position?.[0];

        if (position) {
          setTimeout(() => {
            const input = deepHtmlSearch(
              question.questionDiv,
              `[data-target="${position}"]`
            );

            input?.addEventListener("mouseover", (e) => {
              if (currentIteration !== iteration) return;
              if (e.ctrlKey) {
                input.click();
              }
            });
          }, 100);
        }
      }, 100);
    });
  });
};

const setFillBlanksQuestions = (question) => {
  const currentIteration = iteration;
  const questionDivs = [
    ...deepHtmlSearch(
      question.questionDiv,
      ".fillblanks__item",
      true,
      question.answersLength
    ),
  ];

  if (questionDivs.length > 0) {
    questionDivs.forEach((questionDiv) => {
      const textContent = questionDiv.textContent.trim();

      for (const item of question.items) {
        if (
          textContent.startsWith(removeTagsFromString(item.preText)) &&
          textContent.endsWith(removeTagsFromString(item.postText))
        ) {
          for (const option of item._options) {
            if (option._isCorrect) {
              const dropdownItems = [
                ...deepHtmlSearch(
                  questionDiv,
                  ".dropdown__item",
                  true,
                  item._options.length
                ),
              ];

              for (const dropdownItem of dropdownItems) {
                if (dropdownItem.textContent.trim() === option.text.trim()) {
                  questionDiv.addEventListener("click", (e) => {
                    if (currentIteration !== iteration) return;
                    if (!e.target.textContent?.trim()) return;
                    dropdownItem.click();
                  });

                  dropdownItem.addEventListener("mouseover", (e) => {
                    if (currentIteration !== iteration) return;
                    if (e.ctrlKey) dropdownItem.click();
                  });
                  break;
                }
              }
              break;
            }
          }
          break;
        }
      }
    });
  }
};

const setTableDropdownQuestions = (question) => {
  const currentIteration = iteration;
  const sectionDivs = Array.from(
    deepHtmlSearch(
      question.questionDiv,
      "tbody tr",
      true,
      question.answersLength
    )
  );

  sectionDivs.forEach((section, i) => {
    const optionElements = Array.from(
      deepHtmlSearch(
        section,
        '[role="option"]',
        true,
        question.items[i]._options.length
      )
    );
    const correctOption = question.items[i]._options.find(
      (option) => option._isCorrect
    );

    for (const optionElement of optionElements) {
      if (optionElement.textContent.trim() === correctOption.text.trim()) {
        section.addEventListener("click", () => {
          if (currentIteration !== iteration) return;

          optionElement.click();
        });

        optionElement.addEventListener("mouseover", (e) => {
          if (currentIteration !== iteration) return;
          if (e.ctrlKey) {
            optionElement.click();
          }
        });
        break;
      }
    }
  });
};

// Removed interactive listeners to avoid ghost interactions; solver acts only on explicit start

const removeTagsFromString = (string) =>
  string.replace(/<[^>]*>?/gm, "").trim();

const setIsReady = () => {
  for (const component of components) {
    const questionDiv = deepHtmlSearch(
      document,
      `.${CSS.escape(component._id)}`
    );

    if (questionDiv) return true;
  }

  return false;
};

const main = async () => {
  console.log("[NetAcad Solver] Running main(), iteration:", iteration + 1);

  questions = [];
  iteration++;
  await setQuestionSections();
  setQuestionElements();

  // Notify popup that questions are loaded
  console.log(`[NetAcad Solver] ✅ Loaded ${questions.length} questions`);
  console.log(
    "[NetAcad Solver] Question types:",
    questions.map((q) => q.questionType)
  );

  // If autosolve is active, continue solving
  if (isAutoSolving && startedByGui) {
    setTimeout(autoSolveNext, 500);
  }
};

const suspendMain = () => {
  console.log(
    "[NetAcad Solver] Suspend main started, waiting for page ready..."
  );

  let isReady = false;
  isSuspendRunning = true;

  const checking = async () => {
    if (!isReady) {
      isReady = !!setIsReady();
      if (isReady) {
        console.log("[NetAcad Solver] Page is ready, initializing...");
      }
    } else {
      clearInterval(interval);
      await main();
      isInitiated = true;
      isSuspendRunning = false;
      console.log("[NetAcad Solver] Initialization complete!");
    }
  };

  const interval = setInterval(checking, 1000);
};

// Auto-solve functionality
const solveQuestion = async (
  question,
  options = { advance: true, ignoreSkip: false }
) => {
  if (!question) {
    return false;
  }
  if (question.skip && !options.ignoreSkip) {
    console.log("[NetAcad Solver] Skipping question (skip flag set)");
    return false;
  }

  console.log(
    "[NetAcad Solver] Solving question type:",
    question.questionType,
    "ID:",
    question.id
  );

  try {
    const component = components.find((c) => c._id === question.id);

    if (!component) {
      console.log(
        "[NetAcad Solver] Component not found for question:",
        question.id
      );
      return false;
    }

    if (question.questionType === "basic") {
      console.log(
        "[NetAcad Solver] Solving basic question with",
        question.inputs.length,
        "inputs"
      );

      // Click on question first to reveal answers
      if (question.questionElement) {
        console.log("[NetAcad Solver] Clicking question element");
        question.questionElement.click();
        await sleep(300);
      }

      // Select correct answers
      for (let i = 0; i < question.inputs.length; i++) {
        const { input, label } = question.inputs[i];

        const shouldSelect =
          component._items[i]._shouldBeSelected === true ||
          component._items[i]._isCorrect === true;
        if (shouldSelect) {
          if (!input.checked) {
            console.log("[NetAcad Solver] Selecting answer", i);
            label.click();
            await sleep(100);
          }
        } else {
          if (input.checked) {
            console.log("[NetAcad Solver] Deselecting answer", i);
            label.click();
            await sleep(100);
          }
        }
      }
      console.log("[NetAcad Solver] ✓ Basic question solved");
      if (options.advance) {
        return await advanceToNextQuestion();
      }
      return true;
    } else if (question.questionType === "match") {
      console.log(
        "[NetAcad Solver] Solving match question with",
        question.inputs.length,
        "matches"
      );

      if (question.questionElement) {
        question.questionElement.click();
        await sleep(300);
      }

      for (const input of question.inputs) {
        input[0].click();
        await sleep(100);
        input[1].click();
        await sleep(100);
      }
      console.log("[NetAcad Solver] ✓ Match question solved");
      if (options.advance) {
        return await advanceToNextQuestion();
      }
      return true;
    } else if (question.questionType === "dropdownSelect") {
      console.log("[NetAcad Solver] Solving dropdown question");

      for (let i = 0; i < question.items.length; i++) {
        const item = question.items[i];
        const subQuestionDiv = deepHtmlSearch(
          question.questionDiv,
          `[index="${i}"]`,
          true
        );
        if (!subQuestionDiv) continue;

        const triggerElement = deepHtmlFindByTextContent(
          subQuestionDiv,
          item.text.trim()
        );
        if (triggerElement) {
          triggerElement.click();
          await sleep(300);
        }

        const correctOptionIndex = item._options.findIndex((o) => o._isCorrect);
        if (correctOptionIndex !== -1) {
          const optionElement = deepHtmlSearch(
            subQuestionDiv,
            `#dropdown__item-index-${correctOptionIndex}`,
            true
          );
          if (optionElement) {
            optionElement.click();
            await sleep(200);
          }
        }
      }

      console.log("[NetAcad Solver] ✓ Dropdown question solved");
      if (options.advance) {
        return await advanceToNextQuestion();
      }
      return true;
    } else if (question.questionType === "yesNo") {
      console.log("[NetAcad Solver] Solving yes/no question");
      try {
        const img = deepHtmlSearch(question.questionDiv, ".img_question");
        if (!img || !img.alt) return false;
        const item = question.items.find((it) => it._graphic?.alt === img.alt);
        if (!item) return false;
        const yesBtn = deepHtmlSearch(
          question.questionDiv,
          ".user_selects_yes"
        );
        const noBtn = deepHtmlSearch(question.questionDiv, ".user_selects_no");
        if (item._shouldBeSelected && yesBtn) yesBtn.click();
        if (!item._shouldBeSelected && noBtn) noBtn.click();
        if (options.advance) {
          const advanced = await advanceToNextQuestion();
          if (!advanced) return false;
        }
        console.log("[NetAcad Solver] ✓ Yes/No question solved");
        return true;
      } catch (e) {
        console.log("[NetAcad Solver] Yes/No solve failed:", e?.message || e);
      }
    } else if (question.questionType === "fillBlanks") {
      console.log("[NetAcad Solver] Solving fill blanks question");
      try {
        const blanks = [
          ...(deepHtmlSearch(
            question.questionDiv,
            ".fillblanks__item",
            true,
            question.answersLength
          ) || []),
        ];
        for (const blank of blanks) {
          const textContent = blank.textContent.trim();
          const item = question.items.find(
            (it) =>
              textContent.startsWith(removeTagsFromString(it.preText)) &&
              textContent.endsWith(removeTagsFromString(it.postText))
          );
          if (!item) continue;
          const correct = item._options.find((o) => o._isCorrect);
          if (!correct) continue;
          // open dropdown then click the correct option
          blank.click();
          await sleep(100);
          const optionsEls = [
            ...(deepHtmlSearch(
              blank,
              ".dropdown__item",
              true,
              item._options.length
            ) || []),
          ];
          const matchEl = optionsEls.find(
            (el) => el.textContent.trim() === correct.text.trim()
          );
          matchEl?.click();
          await sleep(50);
        }
        if (options.advance) {
          const advanced = await advanceToNextQuestion();
          if (!advanced) return false;
        }
        console.log("[NetAcad Solver] ✓ Fill blanks question solved");
        return true;
      } catch (e) {
        console.log(
          "[NetAcad Solver] Fill blanks solve failed:",
          e?.message || e
        );
      }
    } else if (question.questionType === "tableDropdown") {
      console.log("[NetAcad Solver] Solving table dropdown question");
      try {
        const rows = Array.from(
          deepHtmlSearch(
            question.questionDiv,
            "tbody tr",
            true,
            question.answersLength
          ) || []
        );
        rows.forEach((row, i) => {
          const optionsEls = Array.from(
            deepHtmlSearch(
              row,
              '[role="option"]',
              true,
              question.items[i]._options.length
            ) || []
          );
          const correct = question.items[i]._options.find((o) => o._isCorrect);
          const target = optionsEls.find(
            (el) => el.textContent.trim() === correct?.text?.trim()
          );
          if (target) target.click();
        });
        if (options.advance) {
          const advanced = await advanceToNextQuestion();
          if (!advanced) return false;
        }
        console.log("[NetAcad Solver] ✓ Table dropdown question solved");
        return true;
      } catch (e) {
        console.log(
          "[NetAcad Solver] Table dropdown solve failed:",
          e?.message || e
        );
      }
    } else if (question.questionType === "openTextInput") {
      console.log("[NetAcad Solver] Solving open text input question");
      try {
        for (let i = 0; i < question.items.length; i++) {
          const item = question.items[i];
          const questionElement = deepHtmlSearch(
            question.questionDiv,
            "#" + CSS.escape(`${question.id}-option-${i}`)
          );
          const button = deepHtmlSearch(
            question.questionDiv,
            `.current-item-${i}`,
            true
          );
          questionElement?.click();
          await sleep(50);
          button?.click();
          await sleep(50);
          const position = item?.position?.[0];
          if (position) {
            const input = deepHtmlSearch(
              question.questionDiv,
              `[data-target="${position}"]`
            );
            input?.click();
            await sleep(30);
          }
        }
        if (options.advance) {
          const advanced = await advanceToNextQuestion();
          if (!advanced) return false;
        }
        console.log("[NetAcad Solver] ✓ Open text input question solved");
        return true;
      } catch (e) {
        console.log(
          "[NetAcad Solver] Open text input solve failed:",
          e?.message || e
        );
      }
    } else {
      console.log(
        "[NetAcad Solver] Unknown question type:",
        question.questionType
      );
    }
  } catch (error) {
    console.error("[NetAcad Solver] ✗ Error solving question:", error);
    return false;
  }

  return false;
};

const autoSolveNext = async () => {
  if (!isAutoSolving) return;

  // Step 1: Find current visible question from DOM
  const currentQuestionDiv = deepHtmlSearch(
    document,
    ".component.mcq.is-question"
  );
  if (!currentQuestionDiv) {
    console.log("[NetAcad Solver] No question visible, stopping");
    isAutoSolving = false;
    return;
  }

  // Step 2: Find the question in our list
  const question = questions.find((q) =>
    currentQuestionDiv.classList.contains(q.id)
  );

  if (!question) {
    console.log("[NetAcad Solver] Question not in components, skipping");
    clickSubmitOrNext();
    if (isAutoSolving) setTimeout(autoSolveNext, autoSolveSpeed);
    return;
  }

  console.log("[NetAcad Solver] Solving question:", question.id);

  // Step 3: Solve it (this will select answers AND click submit)
  const solved = await solveQuestion(question);
  if (solved) overallSolvedCount++;

  // Notify popup
  browser.runtime
    .sendMessage({
      action: "progress",
      current: overallSolvedCount,
      total: totalQuestionsExpected || questions.length,
    })
    .catch(() => {});

  // Step 4: Continue after delay
  if (isAutoSolving) setTimeout(autoSolveNext, autoSolveSpeed);
};

const reinitQuestions = async () => {
  try {
    questions = [];
    iteration++;
    await setQuestionSections();
    setQuestionElements();
    console.log(
      `[NetAcad Solver] ✅ Reloaded ${questions.length} questions after navigation`
    );
  } catch (e) {
    console.log("[NetAcad Solver] Reinit failed:", e?.message || e);
  }
};

const startAutoSolve = () => {
  console.log("[NetAcad Solver] startAutoSolve called");

  isAutoSolving = true;
  autoSolveIndex = 0;
  overallSolvedCount = 0;
  startedByGui = true;

  console.log(`[NetAcad Solver] 🚀 Starting auto-solve`);
  console.log(`[NetAcad Solver] Speed: ${autoSolveSpeed}ms per question`);

  // Notify popup
  browser.runtime
    .sendMessage({
      action: "autoSolveStarted",
      questionCount: totalQuestionsExpected || questions.length,
    })
    .catch((e) => console.log("[NetAcad Solver] Failed to notify popup:", e));

  // Check if we're on the intro/start screen
  const startBtn = deepHtmlSearch(document, ".start-button.start");
  if (startBtn) {
    console.log("[NetAcad Solver] Clicking Start button");
    startBtn.click();
    // Wait for first question to load, then begin
    setTimeout(autoSolveNext, 1000);
  } else {
    // Already in quiz, start immediately
    autoSolveNext();
  }
};

const stopAutoSolve = () => {
  console.log("[NetAcad Solver] 🛑 Auto-solve stopped by user");
  isAutoSolving = false;

  // Notify popup
  browser.runtime
    .sendMessage({
      action: "autoSolveStopped",
      current: autoSolveIndex,
      total: questions.length,
    })
    .catch((e) => console.log("[NetAcad Solver] Failed to notify popup:", e));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helpers to detect current/next question state in the UI
const getActiveBlockIndex = () => {
  try {
    const active = deepHtmlSearch(document, "button.block-button.active-block");
    if (!active) return null;
    const val = active.getAttribute("data-index");
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
  } catch (e) {
    return null;
  }
};

const getQuestionNumberFromTitle = () => {
  try {
    const title = deepHtmlSearch(
      document,
      ".component__title-inner.mcq__title-inner"
    );
    const text = title?.textContent || "";
    const m = text.match(/Question\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  } catch (e) {
    return null;
  }
};

const getUnansweredCount = () => {
  try {
    const buttons = [
      ...(deepHtmlSearch(
        document,
        ".attempted-blocks-inner button.block-button",
        true,
        200
      ) || []),
    ];
    return buttons.filter((b) => b.classList?.contains("highlight")).length;
  } catch (e) {
    return 0;
  }
};

const waitForNextQuestionLoad = async (
  previousIndex,
  previousQuestionNumber,
  timeoutMs = 5000
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(100);
    const idx = getActiveBlockIndex();
    const qNum = getQuestionNumberFromTitle();

    const indexChanged =
      previousIndex != null && idx != null && idx !== previousIndex;
    const titleChanged =
      previousQuestionNumber != null &&
      qNum != null &&
      qNum !== previousQuestionNumber;

    if (indexChanged || titleChanged) return true;
  }
  return false;
};

const advanceToNextQuestion = async () => {
  const prevIndex = getActiveBlockIndex();
  const prevQNum = getQuestionNumberFromTitle();
  // Wait up to 3s for submit to become enabled after selection
  await waitForSubmitEnabled(3000);

  let clicked = clickSubmitOrNext();

  if (!clicked) {
    console.log(
      "[NetAcad Solver] Submit button not found/clicked, trying next block"
    );
    // Fallback: try clicking next block
    if (prevIndex !== null) {
      const nextBlock = deepHtmlSearch(
        document,
        `button.block-button[data-index="${prevIndex + 1}"]`
      );
      if (nextBlock) {
        nextBlock.click();
        clicked = true;
      }
    }
  }

  if (!clicked) {
    console.log("[NetAcad Solver] Failed to advance: no button clicked");
    return false;
  }

  await sleep(100);
  return await waitForNextQuestionLoad(prevIndex, prevQNum, 5000);
};

// Try to navigate to next question strictly via Submit (no arrow navigation)
const clickSubmitOrNext = () => {
  try {
    const selectors = [
      ".submit-button",
      ".next-button",
      "button[aria-label='Next']",
      ".footer-buttons button.primary",
      ".btn-next",
      "button.submit",
      "button.next",
    ];

    for (const selector of selectors) {
      const btn = deepHtmlSearch(document, selector);
      if (btn && !btn.disabled && !btn.classList.contains("is-disabled")) {
        console.log("[NetAcad Solver] Clicking button:", selector);
        btn.click();
        return true;
      }
    }

    // Try finding by text content
    const nextTextBtn =
      deepHtmlFindByTextContent(document, "Next") ||
      deepHtmlFindByTextContent(document, "Submit");
    if (nextTextBtn) {
      const btn = nextTextBtn.closest("button") || nextTextBtn;
      if (!btn.disabled && !btn.classList.contains("is-disabled")) {
        console.log(
          "[NetAcad Solver] Clicking button by text:",
          btn.textContent
        );
        btn.click();
        return true;
      }
    }
  } catch (e) {
    console.error("[NetAcad Solver] Error in clickSubmitOrNext:", e);
  }
  return false;
};

const waitForSubmitEnabled = async (timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const selectors = [
        ".submit-button",
        ".next-button",
        "button[aria-label='Next']",
        ".footer-buttons button.primary",
        ".btn-next",
        "button.submit",
        "button.next",
      ];

      for (const selector of selectors) {
        const btn = deepHtmlSearch(document, selector);
        if (btn && !btn.disabled && !btn.classList.contains("is-disabled"))
          return true;
      }
    } catch (e) {}
    await sleep(100);
  }
  return false;
};

// Navigate to the very first question of the test when possible
const goToFirstQuestion = () => {
  try {
    // On intro/start screen
    const startBtn = deepHtmlSearch(document, ".start-button.start");
    if (startBtn) {
      startBtn.click();
      return true;
    }

    // Block strip first item (Q1)
    const firstBlock = deepHtmlSearch(
      document,
      'button.block-button[data-index="1"]'
    );
    if (firstBlock) {
      firstBlock.click();
      return true;
    }
  } catch (e) {}
  return false;
};

// Determine total number of questions from API (course.json) or DOM labels
const setTotalQuestions = async (componentsUrl) => {
  try {
    // 1) Try DOM first (question-label "1 of N" or .secure-question-count)
    const updateFromDom = () => {
      try {
        const label = deepHtmlSearch(document, ".question-label.is-desktop");
        if (label && label.textContent) {
          const m = label.textContent.match(/\bof\s+(\d+)/i);
          if (m && m[1]) {
            totalQuestionsExpected =
              parseInt(m[1], 10) || totalQuestionsExpected;
          }
        }
        const secureCount = deepHtmlSearch(document, ".secure-question-count");
        if (secureCount && secureCount.textContent) {
          const n = parseInt(secureCount.textContent.trim(), 10);
          if (!isNaN(n)) totalQuestionsExpected = n;
        }
      } catch (e) {}
    };

    updateFromDom();
    if (totalQuestionsExpected > 0) return;

    // Helper to extract count from arbitrary JSON
    const extractQuestionCountFromJson = (obj) => {
      let best = 0;
      const visit = (node, keyPath = []) => {
        if (!node || typeof node !== "object") return;
        // Direct known field
        if (
          Object.prototype.hasOwnProperty.call(node, "secure-question-count") &&
          typeof node["secure-question-count"] === "number"
        ) {
          best = Math.max(best, node["secure-question-count"]);
        }
        // Heuristic: any numeric field whose key hints at total questions
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "number") {
            const key = k.toLowerCase();
            if (
              key.includes("question") &&
              (key.includes("count") || key.includes("total"))
            ) {
              best = Math.max(best, v);
            }
          } else if (v && typeof v === "object") {
            visit(v, keyPath.concat(k));
          }
        }
      };
      visit(obj, []);
      return best;
    };

    // 2) Try course.json derived from componentsUrl
    if (componentsUrl) {
      const courseUrl = componentsUrl.replace(
        /components\.json$/i,
        "course.json"
      );
      try {
        const res = await fetch(courseUrl, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const fromJson = extractQuestionCountFromJson(json);
          if (fromJson && fromJson > 0) {
            totalQuestionsExpected = fromJson;
          } else {
            // Fallback to DOM again after slight delay to let UI render the count.
            await sleep(300);
            updateFromDom();
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
};

if (window) {
  let previousUrl = "";

  console.log("[NetAcad Solver] Setting up URL change detection");

  setInterval(() => {
    if (window.location.href !== previousUrl) {
      console.log(
        "[NetAcad Solver] URL changed from",
        previousUrl,
        "to",
        window.location.href
      );
      previousUrl = window.location.href;

      if (!isSuspendRunning) {
        console.log("[NetAcad Solver] Starting suspend main...");
        suspendMain();
      }
    }
  }, 1000);
}

console.log("[NetAcad Solver] Content script initialization complete");
