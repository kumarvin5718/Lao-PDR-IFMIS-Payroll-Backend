package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.LKGradeDerivationMaster;
import com.ifmis.payroll.entity.master.EducationLevel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LKGradeDerivationRepository extends JpaRepository<LKGradeDerivationMaster, UUID> {

    Optional<LKGradeDerivationMaster> findByEducationLevelIdAndMinExpYearsLessThanEqualAndMaxExpYearsGreaterThanEqual(
            UUID educationLevelId,
            int exp1,
            int exp2
    );

    Optional<LKGradeDerivationMaster> findByEducationLevelAndMinExpYearsAndMaxExpYears(
            EducationLevel educationLevel,
            int minExpYears,
            int maxExpYears
    );

    List<LKGradeDerivationMaster> findByEducationLevel(EducationLevel educationLevel);
}