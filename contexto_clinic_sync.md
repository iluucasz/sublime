
Daniele Janoni Pacheco

neurolog-v2 (1).html
HTML

neurolog-tea.html
HTML

logo nova.png
vc consegue ter acesso a esse aplicativo que está em anexo e conseguimos fazer igual para usarmos na minha clinica. Nome dele Sublime desenvolvimento. Tem a logo

Added Sublime branding
Setup Cloud + schema
Identidade visual Sublime
Auth + tela de login
App shell + crianças
Registro de sessão + anexos
Diário e relatório com IA
Assistente IA
App pronto! O Sublime está no ar com:

Logo Sublime + paleta (azul/amarelo/rosa/navy) integrada ao design system
Login real com e-mail/senha + Google (Lovable Cloud) — primeiro cadastro vira admin da clínica
Cadastro de crianças (apenas admin), seletor de paciente em pílulas
Registro completo de sessão (humor, áreas, estrelas, atividades, observações, recado, anexos no Storage)
Diário com filtro por profissional
Relatório com estatísticas, barras de progresso e geração via Lovable AI (Gemini), com envio por WhatsApp/E-mail/Copiar
Assistente IA com streaming
RLS para que cada profissional veja apenas crianças atribuídas; admin vê tudo
Próximos passos sugeridos: criar a tela "Equipe" para o admin convidar profissionais e atribuir crianças, e exportação do relatório em PDF. É só me pedir.

Update site info for publish
5 de mai., 08:35

Daniele Janoni Pacheco
criei minha conta mas não consigo entrar e precisamos corrigir os nomes das especialidades estão erradas Fonoaudiologia Terapia Ocupacional Psicologia Psicopedagogia Psicomotricidade Supervisor ABA Coordenador ABA Diretoria Musicoterapeuta Nutrição Fisioterapeuta Administrativo Acrescentar essas outras profissões, levando em consideração que Diretoria e Supervisor ABA tem direitos e ver tudo no p ...

Corrigiu login e especialidades
Pronto! Corrigi os dois problemas:

1. Login — o e-mail pedia confirmação. Ativei a confirmação automática e já confirmei sua conta danielejanoni@sublimegrupo.com.br. Pode entrar normalmente agora com sua senha.

2. Especialidades — atualizei a lista de cadastro com os nomes corretos: Fonoaudiologia, Terapia Ocupacional, Psicologia, Psicopedagogia, Psicomotricidade, Supervisor ABA, Coordenador ABA, Diretoria, Musicoterapeuta, Nutrição, Fisioterapeuta, Administrativo (mantidos AT e Aplicadora ABA).

3. Permissões — quem se cadastrar como Diretoria ou Supervisor ABA recebe automaticamente acesso total (admin), vê tudo sem restrições. As demais profissões entram como professional e só acessam crianças que a Diretoria atribuir a elas (controle por módulo via "Equipe / Atribuições" — posso construir essa tela em seguida).

Sua conta foi promovida a Diretoria / admin. Tente entrar agora.

5 de mai., 08:44

Daniele Janoni Pacheco
não foi colocado o controle de módulos de acordo com o cadastro dos colaboradores, eu preciso ter acesso aos profissionais cadastrados para que eu faça esse controle dos módulos com relação a restrição, e falo de poder editar, excluir pacientes, editar e excluir as demais situações dos módulos e preciso ter um controle para ativar ou inativar um colaborador isso será função somente da diretoria/ad ...

Criou tela de gestão da equipe
Pronto. Criei a tela Equipe (visível apenas para Diretoria/Admin e Supervisor ABA / quem tem manage_team), onde você pode:

Ativar/Inativar colaboradores (inativos não conseguem registrar sessões)
Conceder acesso administrativo total (toggle)
Controlar permissões por módulo: editar/excluir pacientes, editar/excluir sessões, ver relatórios, usar IA, gerenciar equipe
As permissões são aplicadas tanto na UI (abas/botões somem) quanto no banco (RLS), então mesmo via API ninguém edita ou exclui sem permissão.

6 de mai., 08:01

Daniele Janoni Pacheco
Bom dia algumas alterações: No item humo permitir marcar mais um item, porque como trabalhamos com crianças neurodivergentes podemos ter varias opções a serem marcadas. na parte de assistente ao invés de sublime, colocar a palavra Subliminho. e um outo ponto eu queria uma sugestão sua, fazemos reuniões de equipes e com base nos módulos que foram criados e nas respostas é possivel desenvolver um mó ...

Adicionou indicadores ao app
Pronto. Resumo das mudanças:

Humor multi-seleção: agora é possível marcar várias opções de humor na sessão (salvas separadas por vírgula).
Subliminho: o Assistente foi renomeado em todo o app (aba, cabeçalho, botão e prompt da IA).
Novo módulo "Indicadores" (acessível por quem tem permissão de Relatórios): inclui
cards com totais de atendimentos, crianças e profissionais ativos no período;
Alertas para estudo de caso — destaca crianças com média baixa, queda de desempenho na 2ª metade do período, alta proporção de humor desafiador ou sem registro há 14+ dias;
gráfico de atendimentos por criança;
distribuição por especialidade (pizza);
evolução semanal das habilidades (geral ou por criança), ideal para devolutivas a pais;
ranking de progresso comparando 1ª × 2ª metade do período.
Tudo pronto para testar nas reuniões de equipe e devolutivas clínicas.

6 de mai., 08:11

Daniele Janoni Pacheco
o assistente não foi nomeado Subliminho

Used 3 tools
O código já está com "Subliminho" (aba, cabeçalho do assistente, botão e prompt do sistema da IA). Acabei de redeployar a edge function — pode ser que estivesse rodando a versão antiga em cache.

Faça logout/login e teste novamente. Se a IA ainda se apresentar como "Sublime", me diga exatamente onde aparece (aba, mensagem da IA, título) que eu ajusto.

6 de mai., 13:06

Daniele Janoni Pacheco
no campo equipe modificar: Diretoria tem acesso a tudo supervisão acesso a tudo coordenação acesso a tudo AT acesso com a escolha da diretoria e supervisor colocar as opções como ja tem Acrescentar acesso a Responsáveis com acesso somente ao diário, graficos, relatorios e ao assistente, com liberação para digitação das perguntas somente do subliminho, os demais módulos esses listados somente consu ...

Atualizou permissões da equipe
Atualizado: Diretoria, Supervisor ABA e Coordenador ABA agora viram admin automaticamente; adicionei a função "Responsáveis" no cadastro com permissões padrão de só consulta (Diário, Relatórios, Indicadores e Subliminho ativo). Ajustes finos por usuário continuam na aba Equipe.