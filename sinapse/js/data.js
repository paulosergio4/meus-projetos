// Conteúdo de exemplo do protótipo.
// Tipos de card: 'basic' (frente e verso), 'cloze' (lacuna: {{resposta}}), 'occlusion' (oclusão de imagem).
// Todo conteúdo médico precisa ser revisado por um profissional antes de ir para produção.

// Todas as grandes áreas da medicina, do ciclo básico à residência.
// Os subtemas que já têm cards prontos mantêm o mesmo nome (o progresso fica ligado a eles).
export const AREAS = [
  { id: 'basico', name: 'Ciclo básico', short: 'Básico', subtemas: ['Anatomia', 'Histologia', 'Embriologia', 'Fisiologia', 'Bioquímica', 'Biologia celular e molecular', 'Genética', 'Imunologia', 'Microbiologia', 'Parasitologia', 'Patologia', 'Farmacologia', 'Semiologia', 'Psicologia médica', 'Bioética'] },
  { id: 'clinica', name: 'Clínica médica', short: 'Clínica', subtemas: ['Cardiologia', 'Pneumologia', 'Gastroenterologia', 'Hepatologia', 'Nefrologia', 'Endocrinologia', 'Reumatologia', 'Hematologia', 'Oncologia', 'Infectologia', 'Neurologia', 'Psiquiatria', 'Dermatologia', 'Geriatria', 'Alergia e imunologia clínica', 'Medicina intensiva', 'Emergência', 'Toxicologia', 'Nutrologia', 'Radiologia e imagem', 'Medicina laboratorial', 'Cuidados paliativos'] },
  { id: 'cirurgia', name: 'Cirurgia', short: 'Cirurgia', subtemas: ['Cirurgia geral', 'Trauma', 'Abdome agudo', 'Pré e pós-operatório', 'Hérnias e parede abdominal', 'Cirurgia do aparelho digestivo', 'Coloproctologia', 'Cirurgia vascular', 'Cirurgia torácica', 'Cirurgia cardiovascular', 'Cirurgia de cabeça e pescoço', 'Cirurgia pediátrica', 'Cirurgia plástica', 'Queimaduras', 'Urologia', 'Ortopedia e traumatologia', 'Neurocirurgia', 'Otorrinolaringologia', 'Oftalmologia', 'Anestesiologia', 'Cirurgia oncológica'] },
  { id: 'go', name: 'Ginecologia e obstetrícia', short: 'GO', subtemas: ['Pré-natal', 'Hipertensão na gestação', 'Sangramentos', 'Diabetes na gestação', 'Parto e assistência ao parto', 'Puerpério e amamentação', 'Medicina fetal', 'Infecções na gestação', 'Abortamento', 'Planejamento familiar', 'Ciclo menstrual e amenorreias', 'Endocrinologia ginecológica', 'Climatério', 'Infecções genitais e ISTs', 'Oncologia ginecológica', 'Mastologia', 'Uroginecologia', 'Infertilidade', 'Violência sexual'] },
  { id: 'pediatria', name: 'Pediatria', short: 'Pediatria', subtemas: ['Neonatologia', 'Puericultura', 'Crescimento e desenvolvimento', 'Aleitamento e nutrição infantil', 'Imunização', 'Infectologia pediátrica', 'Doenças exantemáticas', 'Respiratório', 'Gastroenterologia pediátrica', 'Nefrologia pediátrica', 'Cardiologia pediátrica', 'Neurologia pediátrica', 'Endocrinologia pediátrica', 'Hematologia e oncologia pediátrica', 'Reumatologia', 'Emergências pediátricas', 'Adolescência', 'Genética e síndromes'] },
  { id: 'preventiva', name: 'Medicina preventiva', short: 'Preventiva', subtemas: ['Epidemiologia', 'Bioestatística', 'SUS', 'Políticas de saúde', 'Medicina de família e comunidade', 'Atenção primária', 'Vigilância em saúde', 'Saúde do trabalhador', 'Medicina baseada em evidências', 'Rastreamento e prevenção', 'Ética médica', 'Medicina legal', 'Saúde mental na atenção básica', 'Saúde do idoso', 'Saúde indígena e populações vulneráveis'] },
];

export const PROVAS = ['ENARE', 'SUS-SP', 'USP', 'PSU-MG', 'Faculdade', 'Outra'];

export const FASES = [
  { id: 'basico', name: 'Ciclo básico', hint: '1º ao 4º período · provas da faculdade' },
  { id: 'clinico', name: 'Ciclo clínico', hint: '5º ao 8º período · especialidades' },
  { id: 'residencia', name: 'Internato e residência', hint: '5 grandes áreas · prova de residência' },
  { id: 'formado', name: 'Já sou formado', hint: 'título de especialista e atualização' },
];

// Regiões do traçado de ECG usado na oclusão de imagem (coordenadas do viewBox 0 0 318 200).
export const ECG_REGIONS = [
  { n: 1, x: 36, y: 94, w: 44, h: 44, label: 'Onda P', detail: 'Despolarização atrial.' },
  { n: 2, x: 106, y: 16, w: 56, h: 152, label: 'Complexo QRS', detail: 'Despolarização ventricular.' },
  { n: 3, x: 194, y: 80, w: 62, h: 58, label: 'Onda T', detail: 'Repolarização ventricular.' },
];

export const SEED_CARDS = [
  // Clínica médica
  { id: 'c01', area: 'clinica', sub: 'Cardiologia', type: 'cloze', text: 'Na fibrilação atrial com instabilidade hemodinâmica, a conduta imediata é a {{cardioversão elétrica sincronizada|cardioversão sincronizada|CVE sincronizada}}.', extra: 'Instabilidade: hipotensão, dor torácica isquêmica, rebaixamento de consciência ou congestão pulmonar aguda.' },
  { id: 'c02', area: 'clinica', sub: 'Cardiologia', type: 'basic', front: 'Quais classes de medicamentos reduzem mortalidade na insuficiência cardíaca com fração de ejeção reduzida?', back: 'IECA, BRA ou INRA; betabloqueador; antagonista mineralocorticoide; iSGLT2.' },
  { id: 'c03', area: 'clinica', sub: 'Cardiologia', type: 'cloze', text: 'Supradesnivelamento do segmento ST em DII, DIII e aVF sugere infarto de parede {{inferior}}.' },
  { id: 'c04', area: 'clinica', sub: 'Cardiologia', type: 'occlusion', image: 'ecg', ask: 1 },
  { id: 'c05', area: 'clinica', sub: 'Cardiologia', type: 'occlusion', image: 'ecg', ask: 2 },
  { id: 'c06', area: 'clinica', sub: 'Cardiologia', type: 'occlusion', image: 'ecg', ask: 3 },
  { id: 'c07', area: 'clinica', sub: 'Endocrinologia', type: 'cloze', text: 'Glicemia de jejum maior ou igual a {{126}} mg/dL, confirmada em uma segunda amostra, é critério diagnóstico de diabetes.' },
  { id: 'c08', area: 'clinica', sub: 'Endocrinologia', type: 'cloze', text: 'Hemoglobina glicada maior ou igual a {{6,5|6.5}}% é critério diagnóstico de diabetes.' },
  { id: 'c09', area: 'clinica', sub: 'Pneumologia', type: 'basic', front: 'Qual é o critério espirométrico de obstrução na DPOC?', back: 'Relação VEF1/CVF menor que 0,70 após broncodilatador.' },
  { id: 'c10', area: 'clinica', sub: 'Nefrologia', type: 'cloze', text: 'Na hipercalemia com alteração no ECG, a primeira medida é {{gluconato de cálcio|gluconato de cálcio 10%}} intravenoso, para estabilizar a membrana cardíaca.' },

  // Cirurgia
  { id: 'r01', area: 'cirurgia', sub: 'Trauma', type: 'cloze', text: 'No atendimento inicial ao politraumatizado (ATLS), a avaliação primária segue a sequência {{ABCDE|XABCDE}}.' },
  { id: 'r02', area: 'cirurgia', sub: 'Trauma', type: 'basic', front: 'Quais são os componentes da escala de coma de Glasgow e suas pontuações?', back: 'Abertura ocular (1 a 4), resposta verbal (1 a 5) e resposta motora (1 a 6). Total de 3 a 15.', extra: 'A versão atualizada (Glasgow-P) subtrai pontos pela reatividade pupilar.' },
  { id: 'r03', area: 'cirurgia', sub: 'Abdome agudo', type: 'cloze', text: 'Dor à descompressão brusca no ponto de McBurney (sinal de Blumberg) sugere {{apendicite aguda|apendicite}}.' },
  { id: 'r04', area: 'cirurgia', sub: 'Abdome agudo', type: 'cloze', text: 'Na colecistite aguda, o sinal de {{Murphy}} é a interrupção da inspiração durante a palpação do hipocôndrio direito.' },
  { id: 'r05', area: 'cirurgia', sub: 'Queimaduras', type: 'basic', front: 'Pela regra dos nove, quanto vale a cabeça e cada membro superior em um adulto?', back: '9% cada.' },

  // Ginecologia e obstetrícia
  { id: 'g01', area: 'go', sub: 'Hipertensão na gestação', type: 'cloze', text: 'A pré-eclâmpsia é a hipertensão que surge após {{20}} semanas de gestação, com proteinúria ou sinais de lesão de órgão-alvo.' },
  { id: 'g02', area: 'go', sub: 'Hipertensão na gestação', type: 'basic', front: 'Qual é a droga de escolha para prevenir e tratar convulsões na pré-eclâmpsia grave?', back: 'Sulfato de magnésio.' },
  { id: 'g03', area: 'go', sub: 'Sangramentos', type: 'cloze', text: 'Sangramento indolor, vermelho vivo, na segunda metade da gestação sugere {{placenta prévia|placenta previa}}.' },
  { id: 'g04', area: 'go', sub: 'Sangramentos', type: 'cloze', text: 'No descolamento prematuro de placenta, o sangramento vem com dor e útero {{hipertônico|hipertonia|hipertonico}}.' },
  { id: 'g05', area: 'go', sub: 'Pré-natal', type: 'cloze', text: 'Regra de Naegele: data provável do parto = data da última menstruação + {{7 dias|7|sete dias}}, menos 3 meses.' },

  // Pediatria
  { id: 'p01', area: 'pediatria', sub: 'Neonatologia', type: 'cloze', text: 'O reflexo de Moro costuma desaparecer por volta dos {{4 a 6|4-6|4 e 6|entre 4 e 6|4 a 6 meses}} meses de vida.' },
  { id: 'p02', area: 'pediatria', sub: 'Respiratório', type: 'basic', front: 'Como se trata a bronquiolite viral aguda?', back: 'Suporte: oxigênio se a saturação estiver baixa, hidratação e aspiração nasal. Broncodilatador e corticoide não são indicados de rotina.' },
  { id: 'p03', area: 'pediatria', sub: 'Imunização', type: 'cloze', text: 'A vacina BCG é aplicada {{ao nascer|nascimento|no nascimento|ao nascimento}}, em dose única.' },
  { id: 'p04', area: 'pediatria', sub: 'Reumatologia', type: 'cloze', text: 'Febre por 5 dias ou mais, com conjuntivite, alterações de mucosa oral, exantema, alterações de extremidades e linfadenopatia cervical, sugere doença de {{Kawasaki}}.' },

  // Medicina preventiva
  { id: 'v01', area: 'preventiva', sub: 'Bioestatística', type: 'basic', front: 'Como se calcula a sensibilidade de um teste diagnóstico?', back: 'Verdadeiros positivos ÷ (verdadeiros positivos + falsos negativos).' },
  { id: 'v02', area: 'preventiva', sub: 'Bioestatística', type: 'cloze', text: 'Especificidade é a capacidade de o teste dar resultado {{negativo}} em quem não tem a doença.' },
  { id: 'v03', area: 'preventiva', sub: 'Bioestatística', type: 'cloze', text: 'O valor preditivo positivo {{aumenta|sobe|aumentar}} quando a prevalência da doença aumenta.' },
  { id: 'v04', area: 'preventiva', sub: 'Epidemiologia', type: 'cloze', text: 'Incidência mede os casos {{novos|novo|casos novos}} em um período; prevalência mede todos os casos existentes.' },
  { id: 'v05', area: 'preventiva', sub: 'SUS', type: 'basic', front: 'Quais são os princípios doutrinários do SUS?', back: 'Universalidade, integralidade e equidade.' },
];

// Sugestões de exemplo da tela "Gerar com IA" (modo demonstração do protótipo).
export const IA_DEMO = {
  source: 'Aula 07 · Insuficiência cardíaca.pdf',
  pages: 32,
  area: 'clinica',
  sub: 'Cardiologia',
  cards: [
    { type: 'cloze', text: 'A classificação funcional da NYHA vai da classe {{I}} à classe {{IV}}, conforme a limitação aos esforços.' },
    { type: 'basic', front: 'Qual peptídeo ajuda a afastar insuficiência cardíaca na emergência quando está baixo?', back: 'BNP (ou NT-proBNP).' },
    { type: 'cloze', text: 'Insuficiência cardíaca com fração de ejeção reduzida é definida por FEVE menor ou igual a {{40}}%.' },
    { type: 'basic', front: 'Qual exame de imagem é o principal para avaliar a fração de ejeção?', back: 'Ecocardiograma transtorácico.' },
    { type: 'cloze', text: 'Edema agudo de pulmão hipertensivo: além de oxigênio, usam-se {{vasodilatador|vasodilatadores|nitrato|nitroglicerina}} e diurético de alça.' },
  ],
};
