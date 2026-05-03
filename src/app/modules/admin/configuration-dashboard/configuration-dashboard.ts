import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTypographyModule } from 'ng-zorro-antd/typography';

@Component({
  selector: 'app-configuration-dashboard',
  imports: [RouterLink, NzIconModule, NzTypographyModule],
  templateUrl: './configuration-dashboard.html',
  styleUrl: './configuration-dashboard.scss',
})
export class ConfigurationDashboard {}
