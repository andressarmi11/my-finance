import 'package:flutter/material.dart';

import 'data/db.dart';
import 'data/demo_data.dart';
import 'data/local_repository.dart';
import 'data/seed.dart';
import 'domain/money/format.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'ui/tokens.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final repo = LocalRepository(await abrirDb());
  await ensureSeedData(repo);

  // Mientras no exista el formulario de agregar, la app arranca con datos
  // de ejemplo para que haya algo que mirar. Se va cuando entre la Fase de
  // pantallas de captura.
  if ((await repo.listTransactions()).isEmpty) await sembrarDemo(repo);

  final settings = await repo.getSettings();
  setMoneyLocale(settings.locale, settings.currency);

  runApp(MyFinanceApp(repo: repo));
}

class MyFinanceApp extends StatelessWidget {
  const MyFinanceApp({super.key, required this.repo});

  final LocalRepository repo;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Step up',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: T.q10),
          scaffoldBackgroundColor: T.paper,
          useMaterial3: true,
        ),
        home: DashboardScreen(repo: repo),
      );
}
