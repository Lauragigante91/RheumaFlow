import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { isSpaAxialOnly } from "../lib/diseaseDetection";
import CompositeAssessmentDialog from "../components/clinical/CompositeAssessmentDialog";

jest.mock("../lib/api", () => ({
  assessmentsApi: { listByPatient: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
  labExamsApi: { listByPatient: jest.fn().mockResolvedValue([]) },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("../components/shared/ItalianDatePicker", () => ({
  __esModule: true,
  default: () => null,
}));

const peripheralFormVisible = (spaProfile) => !isSpaAxialOnly(spaProfile);

describe("Visibilità form articolare periferico (AP) per fenotipo SpA", () => {
  test("impegno periferico confermato (peripheral:true) → bottone presente", () => {
    expect(peripheralFormVisible({ peripheral_involvement: true })).toBe(true);
  });

  test("impegno periferico con assiale concomitante (axial:true, peripheral:true) → bottone presente", () => {
    expect(peripheralFormVisible({ axial_involvement: true, peripheral_involvement: true })).toBe(true);
  });

  test("fenotipo non determinato (axial:false, peripheral:false) → bottone presente", () => {
    expect(peripheralFormVisible({ axial_involvement: false, peripheral_involvement: false })).toBe(true);
  });

  test("assiale puro confermato (axial:true, peripheral:false) → bottone assente", () => {
    expect(peripheralFormVisible({ axial_involvement: true, peripheral_involvement: false })).toBe(false);
  });

  test("profilo SpA assente (null) → bottone presente", () => {
    expect(peripheralFormVisible(null)).toBe(true);
  });
});

describe("CompositeAssessmentDialog mode=psa: form unificato AP", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  test("contiene la conta articolare (Homunculus) e la sezione LEI entesiti", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <CompositeAssessmentDialog
          open
          mode="psa"
          patient={{ id: "p-test" }}
          onClose={() => {}}
          onSaved={() => {}}
        />
      );
    });

    const text = document.body.textContent || "";
    expect(text).toContain("DAPSA — Articolazioni 66/68");
    expect(text).toContain("LEI — Entesiti");

    const dialog = document.body.querySelector('[data-testid="composite-psa-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(document.body.querySelector('[data-testid="psa-lei-achilles_l"]')).not.toBeNull();
  });
});
