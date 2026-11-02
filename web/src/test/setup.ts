import '@testing-library/jest-dom';

// jest-fixed-jsdom replaces jsdom's FormData with Node's, which refuses a form from jsdom. React builds a
// FormData from the form whenever a submit handler starts a router navigation (a search that changes the
// address, for example). Browsers handle it natively, so only the tests need this: it reads the named controls.
const NodeFormData = globalThis.FormData;
class FormDataFromForm extends NodeFormData {
  constructor(form?: HTMLFormElement | null) {
    super();
    if (!form) return;
    for (const element of Array.from(form.elements)) {
      const control = element as HTMLInputElement;
      if (control.name && !control.disabled) this.append(control.name, control.value);
    }
  }
}
globalThis.FormData = FormDataFromForm as typeof FormData;
