package com.ifmis.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GradeDerivationUploadRowDto {
    private String educationLevel;
    private String minPriorExp;
    private String maxPriorExp;
    private String derivedGrade;
    private String derivedStep;
    private String ruleDescription;
}
