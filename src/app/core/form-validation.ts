import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export function showValidationErrors(control: AbstractControl): void {
  control.markAllAsDirty();
  if (control instanceof FormGroup || control instanceof FormArray) {
    Object.values(control.controls).forEach(showValidationErrors);
  } else if (control.invalid) {
    // Refresh ng-zorro error tips without emitting changes from valid selections.
    control.updateValueAndValidity({ onlySelf: true });
  }
}
