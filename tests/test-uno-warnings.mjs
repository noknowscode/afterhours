import test from 'node:test';
import assert from 'node:assert/strict';
import {unexpectedWarnings} from '../scripts/uno-warnings.mjs';

const line = text => `/src/x.cs(1,1): ${text} [/src/Afterhours.Uno.csproj::TargetFramework=net10.0-browserwasm]`;

test('trim warnings from generated view models and Uno.Extensions pass the gate', () => {
  const output = [
    line("warning IL2026: Afterhours.Uno.Presentation.MainViewModel.__Reactive_UpdateModel(Object): Using member 'Microsoft.CSharp.RuntimeBinder.Binder.SetMember' which has 'RequiresUnreferencedCodeAttribute'"),
    line("warning IL2026: Afterhours.Uno.App.<OnLaunched>d__9.MoveNext(): Using member 'Uno.Extensions.ApplicationBuilderExtensions.NavigateAsync' which has 'RequiresUnreferencedCodeAttribute'"),
    "warning IL2104: Assembly 'Uno.Extensions.Navigation.UI' produced trim warnings. For more information see https://aka.ms/il2104"
  ].join('\n');
  assert.deepEqual(unexpectedWarnings(output), []);
});

test('any other warning fails, including trim warnings in app code', () => {
  const ours = line("warning IL2026: Afterhours.Uno.Services.GameEvents.Receive(String): Using member 'System.Text.Json.JsonSerializer.Deserialize'");
  const analyzer = line('warning CA1416: This call site is reachable on all platforms.');
  const uno = line('warning Uno0001: Microsoft.UI.Xaml.Controls.ItemsStackPanel.ItemsUpdatingScrollMode is not implemented in Uno');
  assert.equal(unexpectedWarnings([ours, analyzer, uno, ours].join('\n')).length, 3);
});
