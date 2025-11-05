import browser from "webextension-polyfill";
import { deepHtmlSearch, deepHtmlFindByTextContent } from "./domHelper";

console.log("[NetAcad Solver] Content script loaded");

let isSuspendRunning = false;
let isInitiated = false;
const components = [];
let questions = [];
const componentUrls = [];
let iteration = 0;

// Auto-solver state
let isAutoSolving = false;
let autoSolveIndex = 0;
let autoSolveSpeed = 1000; // milliseconds between questions

browser.runtime.onMessage.addListener(async (request) => {
  console.log("[NetAcad Solver] Background message received:", request);

  if (
    request?.componentsUrl &&
    typeof request.componentsUrl === "string" &&
    !componentUrls.includes(request.componentsUrl)
  ) {
    console.log("[NetAcad Solver] New components URL:", request.componentsUrl);
    componentUrls.push(request.componentsUrl);
    await setComponents(request.componentsUrl);
    suspendMain();
  }
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
      setDropdownSelectQuestions(question);
      question.skip = true;
    } else if (question.questionType === "yesNo") {
      // yes - no questions are dynamic - they use the same elements but changes attributes
      initYeNoQuestions(question);
      question.skip = true;
    } else if (question.questionType === "openTextInput") {
      // buttons are static but questions are moving around
      setOpenTextInputQuestions(question);
      question.skip = true;
    } else if (question.questionType === "fillBlanks") {
      setFillBlanksQuestions(question);
      question.skip = true;
    } else if (question.questionType === "tableDropdown") {
      // when there is no description in the table down only mouseover works
      setTableDropdownQuestions(question);
      question.skip = true;
    }

    return question;
  });
};

const setDropdownSelectQuestions = (question) => {
  question.items.forEach((item, i) => {
    const questionDiv = deepHtmlSearch(
      question.questionDiv,
      `[index="${i}"]`,
      true
    );
    const questionElement = deepHtmlFindByTextContent(
      questionDiv,
      item.text.trim()
    );

    for (const [index, option] of item._options.entries()) {
      if (option._isCorrect) {
        const optionElement = deepHtmlSearch(
          questionDiv,
          `#dropdown__item-index-${index}`,
          true
        );

        questions.push({
          questionDiv,
          questionElement,
          inputs: [optionElement],
          questionType: question.questionType,
        });
        return;
      }
    }
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

const initClickListeners = () => {
  const currentIteration = iteration;

  questions.forEach((question) => {
    if (question.skip) return;

    question.questionElement?.addEventListener("click", () => {
      if (currentIteration !== iteration) return;

      if (question.questionType === "basic") {
        const component = components.find((c) => c._id === question.id);

        question.inputs.forEach(({ input, label }, i) => {
          if (input.checked) {
            label.click();
          }

          if (component._items[i]._shouldBeSelected) {
            setTimeout(() => label.click(), 10);
          }
        });
      } else if (question.questionType === "match") {
        question.inputs.forEach((input) => {
          input[0].click();
          input[1].click();
        });
      } else if (question.questionType === "dropdownSelect") {
        question.inputs[0]?.click();
      }
    });
  });
};

const initHoverListeners = () => {
  const currentIteration = iteration;

  questions.forEach((question) => {
    if (question.skip) return;

    const component = components.find((c) => c._id === question.id);

    if (question.questionType === "basic") {
      question.inputs.forEach(({ input, label }, i) => {
        label?.addEventListener("mouseover", (e) => {
          if (currentIteration !== iteration) return;

          if (e.ctrlKey) {
            if (input.checked) {
              label.click();
            }

            if (component._items[i]._shouldBeSelected) {
              setTimeout(() => label.click(), 10);
            }
          }
        });
      });
    } else if (question.questionType === "match") {
      question.inputs.forEach((input) => {
        input[0]?.addEventListener("mouseover", (e) => {
          if (currentIteration !== iteration) return;

          if (e.ctrlKey) {
            input[0].click();
            input[1].click();
          }
        });
      });
    } else if (question.questionType === "dropdownSelect") {
      question.inputs[0]?.addEventListener("mouseover", (e) => {
        if (currentIteration !== iteration) return;

        if (e.ctrlKey) {
          question.inputs[0].click();
        }
      });
    }
  });
};

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
  initClickListeners();
  initHoverListeners();

  // Notify popup that questions are loaded
  console.log(`[NetAcad Solver] ✅ Loaded ${questions.length} questions`);
  console.log(
    "[NetAcad Solver] Question types:",
    questions.map((q) => q.questionType)
  );
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
const solveQuestion = async (question) => {
  if (!question || question.skip) {
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

        if (component._items[i]._shouldBeSelected) {
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
      return true;
    } else if (question.questionType === "dropdownSelect") {
      console.log("[NetAcad Solver] Solving dropdown question");

      if (question.questionElement) {
        question.questionElement.click();
        await sleep(300);
      }

      if (question.inputs[0]) {
        question.inputs[0].click();
        await sleep(200);
      }
      console.log("[NetAcad Solver] ✓ Dropdown question solved");
      return true;
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
  if (!isAutoSolving || autoSolveIndex >= questions.length) {
    if (autoSolveIndex >= questions.length && isAutoSolving) {
      // Completed all questions
      console.log("[NetAcad Solver] All questions completed!");
      isAutoSolving = false;

      // Notify popup
      browser.runtime
        .sendMessage({
          action: "autoSolveComplete",
          questionCount: questions.length,
        })
        .catch(() => {});
    }
    return;
  }

  const question = questions[autoSolveIndex];

  console.log(
    `[NetAcad Solver] Solving question ${autoSolveIndex + 1}/${
      questions.length
    }`
  );

  const solved = await solveQuestion(question);

  autoSolveIndex++;

  // Notify popup of progress
  browser.runtime
    .sendMessage({
      action: "progress",
      current: autoSolveIndex,
      total: questions.length,
    })
    .catch(() => {});

  // Continue with next question after delay
  if (isAutoSolving) {
    setTimeout(autoSolveNext, autoSolveSpeed);
  }
};

const startAutoSolve = () => {
  console.log("[NetAcad Solver] startAutoSolve called");
  console.log("[NetAcad Solver] Questions available:", questions.length);
  console.log("[NetAcad Solver] Components available:", components.length);

  if (questions.length === 0) {
    console.error("[NetAcad Solver] ✗ No questions found!");
    browser.runtime
      .sendMessage({
        action: "error",
        message: "No questions found! Make sure you're on a quiz page.",
      })
      .catch((e) =>
        console.log("[NetAcad Solver] Failed to send error message:", e)
      );
    return;
  }

  isAutoSolving = true;
  autoSolveIndex = 0;

  console.log(
    `[NetAcad Solver] 🚀 Starting auto-solve for ${questions.length} questions`
  );
  console.log(`[NetAcad Solver] Speed: ${autoSolveSpeed}ms per question`);

  // Notify popup
  browser.runtime
    .sendMessage({
      action: "autoSolveStarted",
      questionCount: questions.length,
    })
    .catch((e) => console.log("[NetAcad Solver] Failed to notify popup:", e));

  autoSolveNext();
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

// Listen for messages from popup
browser.runtime.onMessage.addListener((request) => {
  console.log("[NetAcad Solver] Popup message received:", request);

  try {
    if (request.action === "getStatus") {
      const status = {
        questionCount: questions.length,
        isAutoSolving: isAutoSolving,
        currentQuestion: autoSolveIndex,
      };
      console.log("[NetAcad Solver] Sending status:", status);
      return status;
    } else if (request.action === "startAutoSolve") {
      console.log(
        "[NetAcad Solver] Starting auto-solve with speed:",
        request.speed
      );

      // Set speed from popup
      if (request.speed !== undefined) {
        const delays = [3000, 2000, 1000, 500, 200];
        autoSolveSpeed = delays[request.speed - 1] || 1000;
        console.log("[NetAcad Solver] Speed set to:", autoSolveSpeed, "ms");
      }

      startAutoSolve();
      return { success: true, questionCount: questions.length };
    } else if (request.action === "stopAutoSolve") {
      console.log("[NetAcad Solver] Stopping auto-solve");
      stopAutoSolve();
      return { success: true };
    } else if (request.action === "refresh") {
      console.log("[NetAcad Solver] Refresh requested");
      return {
        success: true,
        questionCount: questions.length,
      };
    }
  } catch (error) {
    console.error("[NetAcad Solver] Error handling message:", error);
    return { success: false, error: error.message };
  }

  // Not handled
  return null;
});
